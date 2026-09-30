import { boardToText } from '@/core/board'
import type { Board, PieceType } from '@/core/constants'
import { describePlacement } from './describe'
import { rankPlacements, selectCandidates } from './heuristic'
import { HttpLayaClient } from './layaClient'
import { MockLayaClient } from './mockClient'
import { enumeratePlacements, normalizeHeuristicScores } from './placement'
import type { AppSettings } from './settings'
import type {
  DecisionProgress,
  DecisionResult,
  DecisionSource,
  DecisionStageHandler,
  EvaluatedCandidate,
  EvalContext,
} from './types'

export interface DecideInput {
  board: Board
  current: PieceType
  nextTypes: PieceType[]
  pieceId: number
}

/**
 * 决策编排（严格对齐 Laya 社区 Tetris 用法）：
 *   枚举全部合法落点 → 启发式筛出 N 个候选 → 并行询问「这个落点好吗」→ 取 noul 最高者。
 * 若最高 noul 低于阈值或全部请求失败，按协议降级为启发式最优落点，并在结果里标注来源。
 * 设置里可关闭「允许启发式兜底」：关闭后阈值不再生效，只有全部请求失败时才会降级。
 *
 * 每个阶段的耗时都会记录下来（onStage 回调 + result.stages），供界面可视化整条决策链路。
 */
export class Autopilot {
  private http: HttpLayaClient
  private mock = new MockLayaClient()

  constructor(private readonly getSettings: () => AppSettings) {
    this.http = new HttpLayaClient(getSettings)
  }

  async probe() {
    return this.http.probe()
  }

  async decide(
    input: DecideInput,
    onProgress?: (progress: DecisionProgress) => void,
    onStage?: DecisionStageHandler,
  ): Promise<DecisionResult | null> {
    const settings = this.getSettings()

    onStage?.('enumerate')
    const enumerateStart = performance.now()
    const allOptions = enumeratePlacements(input.board, input.current)
    const enumerateMs = performance.now() - enumerateStart
    if (allOptions.length === 0) return null
    onStage?.('enumerate', { placements: allOptions.length })

    onStage?.('rank')
    const rankStart = performance.now()
    const candidates = selectCandidates(allOptions, settings.candidateCount)
    const heuristicBest = rankPlacements(allOptions)[0]
    const rankHints = normalizeHeuristicScores(candidates)
    const rankMs = performance.now() - rankStart
    onStage?.('rank', { placements: allOptions.length, candidates: candidates.length })

    const boardText = boardToText(input.board, settings.flipBoardRows)
    const decisionId = `d${input.pieceId}-${Date.now().toString(36)}`
    const nextPieces = input.nextTypes.slice(0, 3)

    const evaluated: EvaluatedCandidate[] = candidates.map((option) => ({
      ...option,
      description: describePlacement(input.current, option, nextPieces),
      status: 'pending',
      noul: null,
      confidence: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
    }))

    const publish = () =>
      onProgress?.({
        decisionId,
        piece: input.current,
        pieceId: input.pieceId,
        candidates: evaluated.map((item) => ({ ...item })),
        bestHeuristicId: heuristicBest.id,
      })

    publish()

    const client = settings.useMock ? this.mock : this.http
    const context: EvalContext = {
      boardText,
      currentPiece: input.current,
      nextPieces,
      rankHint: 0,
    }

    onStage?.('query', { candidates: evaluated.length })
    const queryStart = performance.now()

    await Promise.all(
      evaluated.map((item) =>
        client
          .evaluate({
            candidate: item,
            description: item.description,
            context: { ...context, rankHint: rankHints.get(item.id) ?? 0.5 },
          })
          .then((result) => {
            item.status = 'ok'
            item.noul = result.noul
            item.confidence = result.confidence
            item.latencyMs = result.latencyMs
            item.inputTokens = result.inputTokens
            item.outputTokens = result.outputTokens
            item.routingReason = result.routingReason
            item.request = result.request
            item.response = result.response
          })
          .catch((error: unknown) => {
            item.status = 'error'
            item.error = error instanceof Error ? error.message : String(error)
            console.error(`[autopilot] 候选 ${item.id} 评估失败`, error)
          })
          .finally(publish),
      ),
    )

    const queryMs = performance.now() - queryStart
    onStage?.('select')

    const succeeded = evaluated.filter((item) => item.status === 'ok' && item.noul !== null)
    const failedCount = evaluated.length - succeeded.length
    const tokenTotal = evaluated.reduce((acc, item) => acc + (item.inputTokens ?? 0), 0)
    const totalLatencyMs = performance.now() - queryStart + enumerateMs + rankMs

    const fallbackCandidate =
      evaluated.find((item) => item.id === heuristicBest.id) ?? {
        ...heuristicBest,
        description: describePlacement(input.current, heuristicBest, nextPieces),
        status: 'pending' as const,
        noul: null,
        confidence: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
      }

    let source: DecisionSource = settings.useMock ? 'mock' : 'laya'
    let selected = fallbackCandidate
    let reason: string

    if (succeeded.length === 0) {
      source = 'heuristic-fallback'
      selected = fallbackCandidate
      reason = `全部 ${evaluated.length} 个候选请求失败（${evaluated[0]?.error ?? '未知错误'}），没有可用的模型判定，降级为启发式最优落点。`
    } else {
      const best = succeeded.reduce((acc, item) => ((item.noul ?? 0) > (acc.noul ?? 0) ? item : acc))
      const prefix = settings.useMock ? 'Mock' : 'Laya'
      if (!settings.heuristicFallback) {
        // 关闭兜底：完全由模型决策，不设阈值门槛
        selected = best
        reason = `${prefix} 判定：已关闭启发式兜底，直接采用 ${succeeded.length} 个候选中 noul 最高的落点（${
          best.noul ?? 0
        }）。`
      } else if ((best.noul ?? 0) >= settings.threshold) {
        selected = best
        reason = `${prefix} 判定：noul ${(best.noul ?? 0).toFixed(4)} 是 ${
          succeeded.length
        } 个候选中的最高值（阈值 ${settings.threshold}）。`
      } else {
        source = 'heuristic-fallback'
        selected = fallbackCandidate
        reason = `最高 noul ${(best.noul ?? 0).toFixed(4)} 低于阈值 ${settings.threshold}，按协议降级为启发式最优落点。`
      }
    }

    const heuristicBestEvaluated = evaluated.find((item) => item.id === heuristicBest.id)

    return {
      decisionId,
      pieceId: input.pieceId,
      piece: input.current,
      createdAt: Date.now(),
      source,
      selectedId: selected.id,
      candidates: evaluated,
      reason,
      totalLatencyMs,
      requestCount: evaluated.length,
      failedCount,
      tokenTotal,
      threshold: settings.threshold,
      boardText,
      stages: {
        placements: allOptions.length,
        candidateCount: candidates.length,
        enumerateMs,
        rankMs,
        queryMs,
        heuristicBestNoul: heuristicBestEvaluated?.noul ?? null,
        adoptedHeuristicBest: selected.id === heuristicBest.id,
      },
    }
  }
}
