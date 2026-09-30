import type { Board, PieceType } from '@/core/constants'
import type { BoardMetrics, FeatureBreakdown } from '@/core/metrics'

/** ---------- Laya /v1/systemone 协议类型（严格对齐社区 noul 用法） ---------- */

export interface LayaState {
  /** 20 行 × 10 列，'#' 占用 / '.' 空；默认第一行为最顶行 */
  board: string
  current_piece: PieceType
  next_pieces: PieceType[]
  /** 中文自然语言陈述，是 Laya 判断的唯一语义输入 */
  candidate_placement: string
  board_metrics: BoardMetrics
}

export interface LayaRequestBody {
  model: string
  state: LayaState
  questions: {
    is_good_placement: {
      type: 'noul'
      instructions: string
    }
  }
}

export interface LayaResponseBody {
  model?: string
  answers?: Record<
    string,
    {
      type?: string
      noul?: number
      confidence?: number
      answer_confidence?: number
      action?: { act_probability?: number }
    }
  >
  usage?: { input_tokens?: number; output_tokens?: number }
  routing?: { model?: string; repo?: string; reason?: string }
}

/** ---------- 落点候选与决策结果（UI 只消费这一层） ---------- */

export interface PlacementOption {
  id: string
  /** 该落点所属的方块类型 */
  type: PieceType
  rotation: number
  /** 矩阵原点所在列（0 基） */
  x: number
  /** 实际占据的列区间（1 基，便于展示） */
  columnRange: [number, number]
  cells: Array<[number, number]>
  /** 模拟硬降 + 消行之后的棋盘 */
  lockedBoard: Board
  rowsCleared: number[]
  metrics: BoardMetrics
  features: FeatureBreakdown
  heuristicScore: number
  rotationLabel: string
}

export type CandidateStatus = 'pending' | 'ok' | 'error'

export interface EvaluatedCandidate extends PlacementOption {
  description: string
  status: CandidateStatus
  noul: number | null
  confidence: number | null
  latencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  routingReason?: string
  error?: string
  request?: LayaRequestBody
  response?: LayaResponseBody | null
}

export type DecisionSource = 'laya' | 'heuristic-fallback' | 'mock'

/** 决策各阶段的可观测信息，用于可视化「决策过程」 */
export interface DecisionStages {
  /** 枚举出的合法落点总数 */
  placements: number
  /** 询问模型的候选数量 */
  candidateCount: number
  enumerateMs: number
  rankMs: number
  queryMs: number
  /** 启发式最优候选的 noul：用于判断模型是否与启发式一致 */
  heuristicBestNoul: number | null
  /** 最终选中者是否为启发式最优 */
  adoptedHeuristicBest: boolean
}

export interface DecisionResult {
  decisionId: string
  pieceId: number
  piece: PieceType
  createdAt: number
  source: DecisionSource
  selectedId: string
  candidates: EvaluatedCandidate[]
  reason: string
  totalLatencyMs: number
  requestCount: number
  failedCount: number
  tokenTotal: number
  threshold: number
  boardText: string
  stages: DecisionStages
}

export interface EvalResult {
  noul: number
  confidence: number
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number
  routingReason?: string
  request: LayaRequestBody
  response: LayaResponseBody | null
}

export interface EvalContext {
  boardText: string
  currentPiece: PieceType
  nextPieces: PieceType[]
  /** 启发式归一化排名 0~1，供 Mock 客户端产生合理概率 */
  rankHint: number
}

export interface EvalInput {
  candidate: PlacementOption
  /** 送给模型的中文落点陈述 */
  description: string
  context: EvalContext
}

export interface LayaClientLike {
  readonly kind: 'laya' | 'mock'
  evaluate(input: EvalInput, signal?: AbortSignal): Promise<EvalResult>
}

export interface ProbeResult {
  ok: boolean
  latencyMs: number
  message: string
  noul?: number
}

export type DecisionStageName = 'enumerate' | 'rank' | 'query' | 'select'

export type DecisionStageHandler = (
  stage: DecisionStageName,
  info?: { placements?: number; candidates?: number },
) => void

export interface DecisionProgress {
  decisionId: string
  piece: PieceType
  pieceId: number
  candidates: EvaluatedCandidate[]
  bestHeuristicId: string
}
