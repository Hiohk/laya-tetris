import { Autopilot } from '@/ai/autopilot'
import { rankPlacements } from '@/ai/heuristic'
import { enumeratePlacements } from '@/ai/placement'
import { DEFAULT_SETTINGS, type AppSettings } from '@/ai/settings'
import type { DecisionResult, DecisionStageName, EvaluatedCandidate, PlacementOption } from '@/ai/types'
import { boardToText } from '@/core/board'
import { GameEngine, type EngineEvent } from '@/core/engine'
import type { Board, PieceType } from '@/core/constants'
import { rotationName } from '@/core/constants'
import { Effects } from '@/ui/effects'
import { CANDY_COLORS, CANDY_PALETTE } from '@/ui/render'
import { Sfx } from '@/ui/sfx'
import { useGameStore, type DriveMode, type RuntimePhase } from './useGameStore'

export interface BoardOverlay {
  candidates: EvaluatedCandidate[]
  selectedId: string
  pieceId: number
}

/** 落子执行阶段：先预览目标落点，再旋转平移，最后悬停确认后硬降 */
type PlanPhase = 'preview' | 'travel' | 'hover'

interface PlacementPlan {
  targetRotation: number
  targetX: number
  targetLabel: string
  phase: PlanPhase
  acc: number
}

/**
 * 运行时：把引擎、Autopilot、store 与渲染粘在一起。
 * 高频数据（棋盘、当前方块）只存在于引擎里，画布每帧直接读取，不进 React state。
 *
 * 落子被拆成「预览 → 移动 → 悬停 → 硬降」四个可观察阶段，
 * 每个阶段的耗时都可在设置里调节，方便把决策与执行过程完整演示出来。
 */
class TetrisRuntime {
  engine = new GameEngine()
  /** 消行粒子/闪光/震动，画布每帧读取 */
  effects = new Effects()
  overlay: BoardOverlay = { candidates: [], selectedId: '', pieceId: 0 }

  private sfx = new Sfx()
  private scoreRef = 0
  private autopilot!: Autopilot
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private mode: DriveMode = 'laya'
  private rafId: number | null = null
  private lastTs = 0
  private syncAcc = 0
  private runStartedAt = 0
  private clearedTotal = 0

  private deciding = false
  private lastDecidedPieceId = -1
  private plan: PlacementPlan | null = null
  private stuck = 0
  private stepMode = false

  private initialized = false
  private unsubscribers: Array<() => void> = []

  init(): void {
    if (this.initialized) return
    this.initialized = true
    const state = useGameStore.getState()
    this.settings = state.settings
    this.mode = state.mode
    this.autopilot = new Autopilot(() => this.settings)

    this.unsubscribers.push(
      useGameStore.subscribe((next) => {
        this.settings = next.settings
        this.mode = next.mode
        this.engine.speedScale = next.settings.speedScale
        this.sfx.muted = !next.settings.soundOn
      }),
      this.engine.on((event) => this.handleEvent(event)),
    )
    this.sfx.muted = !this.settings.soundOn

    this.engine.speedScale = this.settings.speedScale
    this.syncStore()
    this.lastTs = 0
    this.rafId = requestAnimationFrame(this.loop)

    // 「启动后自动开始」：刷新页面即进入自动对战（此前只在 reset() 里生效，冷启动不认）
    if (this.settings.autoStart) this.start()
  }

  dispose(): void {
    this.initialized = false
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.unsubscribers.forEach((unsubscribe) => unsubscribe())
    this.unsubscribers = []
  }

  private loop = (ts: number) => {
    // 卸载后可能还有一帧已排队的回调，直接退出避免空转
    if (!this.initialized) return
    const dt = this.lastTs === 0 ? 16 : Math.min(ts - this.lastTs, 140)
    this.lastTs = ts
    this.step(dt)
    this.rafId = requestAnimationFrame(this.loop)
  }

  private step(dt: number): void {
    const { freezeWhileThinking } = this.settings
    const busy = this.deciding || this.plan !== null

    if (this.engine.status === 'running') {
      if (!(busy && freezeWhileThinking)) this.engine.tick(dt)
      this.advancePlan(dt)
      this.maybeDecide()
    }

    this.effects.update(dt)

    this.syncAcc += dt
    if (this.syncAcc >= 240) {
      this.syncAcc = 0
      this.syncStore()
    }
  }

  private phase(next: RuntimePhase, detail = ''): void {
    useGameStore.getState().setPhase(next, detail)
  }

  /** 每个方块只决策一次；落定后留出观察窗口，避免下一条决策盖掉消行闪光 */
  private maybeDecide(): void {
    if (this.mode === 'manual' || this.deciding || this.plan) return
    const piece = this.engine.current
    if (!piece || piece.pieceId === this.lastDecidedPieceId) return
    if (this.engine.lastLockAt > 0 && performance.now() - this.engine.lastLockAt < this.settings.settleMs) return
    this.lastDecidedPieceId = piece.pieceId
    void this.runDecision(piece.pieceId, piece.type)
  }

  private async runDecision(pieceId: number, piece: PieceType): Promise<void> {
    const store = useGameStore.getState()
    this.deciding = true
    store.setThinking(true)
    this.phase('enumerate', '扫描全部旋转态与横向位置')

    const snapshot = this.engine.snapshot()

    if (this.mode === 'heuristic') {
      const result = this.buildHeuristicResult(snapshot.board, piece, pieceId)
      useGameStore.getState().pushDecision(result, 'heuristic')
      this.deciding = false
      useGameStore.getState().setThinking(false)
      this.schedulePlan(result)
      return
    }

    const handleStage = (stage: DecisionStageName, info?: { placements?: number; candidates?: number }) => {
      if (stage === 'enumerate') {
        this.phase('enumerate', info?.placements ? `找到 ${info.placements} 个合法落点` : '扫描全部旋转态与横向位置')
      }
      if (stage === 'rank') {
        this.phase('rank', info?.candidates ? `评分排序，取前 ${info.candidates} 个候选` : '按 Dellacherie 评分排序')
      }
      if (stage === 'query') {
        this.phase('query', `并行询问模型 ${info?.candidates ?? 0} 个候选`)
      }
      if (stage === 'select') {
        this.phase('select', '比较 noul 概率并选定落点')
      }
    }

    const result = await this.autopilot.decide(
      {
        board: snapshot.board,
        current: piece,
        nextTypes: snapshot.nextTypes,
        pieceId,
      },
      (progress) => {
        useGameStore.getState().pushProgress(progress)
        this.overlay = { candidates: progress.candidates, selectedId: '', pieceId: progress.pieceId }
      },
      handleStage,
    )

    this.deciding = false
    useGameStore.getState().setThinking(false)

    if (!result) {
      console.error('[runtime] 当前方块没有合法落点，直接硬降')
      this.engine.hardDrop()
      return
    }

    useGameStore.getState().pushDecision(result, this.mode)
    this.schedulePlan(result)
  }

  /** 纯启发式模式：不联网，直接采用 Dellacherie 评分最优落点 */
  private buildHeuristicResult(board: Board, piece: PieceType, pieceId: number): DecisionResult {
    const started = performance.now()
    const options = enumeratePlacements(board, piece)
    const enumerateMs = performance.now() - started
    const ranked = rankPlacements(options)
    const best = ranked[0]
    const candidates: EvaluatedCandidate[] = ranked.slice(0, this.settings.candidateCount).map((option: PlacementOption) => ({
      ...option,
      description: `启发式评分 ${option.heuristicScore.toFixed(2)}：消除 ${option.metrics.lines_cleared} 行，空洞 ${option.metrics.holes}，最高 ${option.metrics.max_height} 层。`,
      status: 'ok' as const,
      noul: null,
      confidence: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
    }))

    return {
      decisionId: `h${pieceId}-${Date.now().toString(36)}`,
      pieceId,
      piece,
      createdAt: Date.now(),
      source: 'heuristic-fallback',
      selectedId: best.id,
      candidates,
      reason: `启发式模式：直接采用 Dellacherie 评分最优落点（${best.heuristicScore.toFixed(2)}）。`,
      totalLatencyMs: performance.now() - started,
      requestCount: 0,
      failedCount: 0,
      tokenTotal: 0,
      threshold: this.settings.threshold,
      boardText: boardToText(board, this.settings.flipBoardRows),
      stages: {
        placements: options.length,
        candidateCount: candidates.length,
        enumerateMs,
        rankMs: performance.now() - started - enumerateMs,
        queryMs: 0,
        heuristicBestNoul: null,
        adoptedHeuristicBest: true,
      },
    }
  }

  private schedulePlan(result: DecisionResult): void {
    const selected = result.candidates.find((item) => item.id === result.selectedId)
    if (!selected) return
    // 请求返回时如果已经切到人工模式，AI 不应再动手
    if (this.mode === 'manual') return
    // 决策期间方块可能已经落定（例如关闭了「思考期间冻结重力」），此时丢弃过期计划
    if (this.engine.current?.pieceId !== result.pieceId) {
      console.error('[runtime] 决策结果对应的方块已落定，丢弃本次计划')
      return
    }
    const [left, right] = selected.columnRange
    const columnText = left === right ? `第 ${left} 列` : `第 ${left}~${right} 列`
    this.overlay = { candidates: result.candidates, selectedId: result.selectedId, pieceId: result.pieceId }
    this.plan = {
      targetRotation: selected.rotation,
      targetX: selected.x,
      targetLabel: `${rotationName(result.piece, selected.rotation)} · ${columnText}`,
      phase: 'preview',
      acc: 0,
    }
    this.stuck = 0
    this.phase('preview', `目标落点：${this.plan.targetLabel}`)
  }

  private advancePlan(dt: number): void {
    const plan = this.plan
    if (!plan) return
    plan.acc += dt

    if (plan.phase === 'preview') {
      if (plan.acc >= this.settings.previewMs) {
        plan.acc = 0
        plan.phase = 'travel'
        this.phase('travel', `旋转并平移至 ${plan.targetLabel}`)
      }
      return
    }

    if (plan.phase === 'travel') {
      const delay = Math.max(24, this.settings.moveDelayMs)
      const steps = Math.floor(plan.acc / delay)
      if (steps <= 0) return
      plan.acc -= steps * delay
      for (let i = 0; i < steps; i += 1) {
        this.applyOneAction()
        if (!this.plan || this.plan.phase !== 'travel') return
      }
      return
    }

    if (plan.acc >= this.settings.hoverMs) {
      plan.acc = 0
      this.engine.hardDrop()
      this.plan = null
      this.stuck = 0
      this.phase('drop', '硬降锁定')
      if (this.stepMode) {
        this.stepMode = false
        this.engine.pause()
        this.phase('idle', '单步已完成，继续点「单步」可逐步观察')
      }
      this.syncStore()
    }
  }

  private applyOneAction(): void {
    const plan = this.plan
    const piece = this.engine.current
    if (!plan) return
    if (!piece) {
      this.plan = null
      return
    }

    if (piece.rotation !== plan.targetRotation) {
      const clockwise = ((plan.targetRotation - piece.rotation) % 4 + 4) % 4
      this.trackProgress(this.engine.rotate(clockwise <= 2 ? 1 : -1))
      return
    }

    if (piece.x !== plan.targetX) {
      this.trackProgress(this.engine.move(Math.sign(plan.targetX - piece.x)))
      return
    }

    plan.phase = 'hover'
    plan.acc = 0
    this.phase('hover', '落点已对齐，悬停确认后硬降')
  }

  private trackProgress(changed: boolean): void {
    if (changed) {
      this.stuck = 0
      return
    }
    this.stuck += 1
    if (this.stuck > 10) {
      console.error('[runtime] 落点执行受阻，直接硬降至当前位置')
      this.engine.hardDrop()
      this.plan = null
      this.stuck = 0
    }
  }

  private handleEvent(event: EngineEvent): void {
    const store = useGameStore.getState()

    if (event.kind === 'lock') {
      this.clearedTotal += event.lines
      const delta = this.engine.score - this.scoreRef
      this.scoreRef = this.engine.score

      if (event.lines > 0) {
        this.effects.flash(event.clearedRows)
        event.clearedRows.forEach((row) =>
          this.effects.burstRow(row, Object.values(CANDY_COLORS), CANDY_COLORS[event.type]),
        )
        this.effects.shake(event.lines >= 4 ? 1.7 : event.lines >= 2 ? 1.25 : 0.9)
        this.sfx.play(event.combo > 0 ? 'combo' : 'clear')
        this.effects.popup(
          event.combo > 0 ? `连击 ${event.combo + 1}！+${delta}` : `+${delta}`,
          5,
          Math.max(2.4, event.clearedRows[0] - 0.6),
          event.combo > 0 ? CANDY_PALETTE.lemon : CANDY_PALETTE.mint,
        )
      } else {
        this.sfx.play('drop')
      }
    }

    if (event.kind === 'gameover') {
      store.setStatus('over')
      this.plan = null
      this.phase('idle', '棋局结束')
      this.sfx.play('over')
    }

    // 人工操作时给每个动作配一声，自动模式不刷屏
    if (this.mode === 'manual') {
      if (event.kind === 'move') this.sfx.play('move')
      if (event.kind === 'rotate') this.sfx.play('rotate')
      if (event.kind === 'hold') this.sfx.play('hold')
    }

    if (event.kind === 'gameover' || event.kind === 'lock' || event.kind === 'levelup') {
      this.syncStore()
    }
  }

  private syncStore(): void {
    const engine = this.engine
    const elapsedSec = this.runStartedAt > 0 ? (performance.now() - this.runStartedAt) / 1000 : 0
    useGameStore.getState().syncRuntime({
      score: engine.score,
      lines: engine.lines,
      level: engine.level,
      combo: Math.max(1, engine.combo + 1),
      pieces: engine.pieces,
      elapsedSec: Number(elapsedSec.toFixed(1)),
      pps: elapsedSec > 0.5 ? Number((engine.pieces / elapsedSec).toFixed(2)) : 0,
      clearedRows: this.clearedTotal,
      status: engine.status,
      hold: engine.hold,
      nextTypes: engine.nextTypes,
      currentType: engine.current?.type ?? null,
      currentPieceId: engine.current?.pieceId ?? 0,
    })
  }

  /* ---------------- 外部命令 ---------------- */

  start(): void {
    const store = useGameStore.getState()
    this.sfx.resume()
    if (this.engine.status === 'over') this.reset()
    if (this.engine.status === 'ready') {
      this.runStartedAt = performance.now()
      this.engine.start()
    } else {
      this.engine.resume()
    }
    this.stepMode = false
    this.syncStore()
    store.setStatus(this.engine.status)
  }

  pause(): void {
    this.engine.pause()
    this.stepMode = false
    this.syncStore()
  }

  togglePause(): void {
    const engine = this.engine
    if (engine.status === 'running') engine.pause()
    else if (engine.status === 'paused') engine.resume()
    else this.start()
    this.stepMode = false
    this.syncStore()
  }

  reset(): void {
    this.engine.reset()
    this.plan = null
    this.deciding = false
    this.lastDecidedPieceId = -1
    this.clearedTotal = 0
    this.runStartedAt = 0
    this.stepMode = false
    this.scoreRef = 0
    this.effects.clear()
    this.overlay = { candidates: [], selectedId: '', pieceId: 0 }
    const store = useGameStore.getState()
    store.resetSession()
    store.setStatus('ready')
    store.setPhase('idle')
    if (this.settings.autoStart) this.start()
    else this.syncStore()
  }

  /**
   * 单步：只推进一个方块 —— 完成一次决策 + 分阶段落子，然后自动暂停，
   * 便于一帧一帧地观察「枚举 → 筛选 → 询问 → 选优 → 执行」整条链路。
   */
  stepOnce(): void {
    if (this.engine.status === 'over') this.reset()
    if (this.engine.status === 'ready') {
      this.runStartedAt = performance.now()
      this.engine.start()
    }
    if (this.engine.status === 'paused') this.engine.resume()
    this.stepMode = true
    this.syncStore()
    const piece = this.engine.current
    if (!piece || this.deciding || this.plan) return
    this.lastDecidedPieceId = piece.pieceId
    void this.runDecision(piece.pieceId, piece.type)
  }

  /**
   * 任何人工输入都会自动接管：AI 托管期间点方向键 / 摸棋盘 = 立刻切到人工模式并执行该操作，
   * 避免「按钮点了没反应」；待机或已结束时顺带开局，避免「必须先点开始」。
   */
  private ensureManual(): boolean {
    if (this.mode !== 'manual') {
      this.mode = 'manual'
      useGameStore.getState().setMode('manual')
      this.onModeChanged()
    }
    this.sfx.resume()
    if (this.engine.status === 'ready' || this.engine.status === 'over') this.start()
    return this.engine.status === 'running'
  }

  manualMove(dx: number): void {
    if (!this.ensureManual()) return
    this.engine.move(dx)
  }

  manualRotate(direction: number): void {
    if (!this.ensureManual()) return
    this.engine.rotate(direction)
  }

  manualSoftDrop(): void {
    if (!this.ensureManual()) return
    this.engine.softDrop()
  }

  manualHardDrop(): void {
    if (!this.ensureManual()) return
    this.engine.hardDrop()
  }

  manualHold(): void {
    if (!this.ensureManual()) return
    this.engine.holdPiece()
  }

  /** 切到人工模式时清掉 AI 计划，切回自动时允许立即决策 */
  onModeChanged(): void {
    this.plan = null
    this.stuck = 0
    this.stepMode = false
    this.lastDecidedPieceId = -1
    this.overlay = { ...this.overlay, selectedId: '' }
    this.phase(this.mode === 'manual' ? 'manual' : 'idle', this.mode === 'manual' ? '等待键盘操作' : '')
  }

  async probeConnection(): Promise<void> {
    const store = useGameStore.getState()
    store.setConnection({ state: 'checking', message: '正在请求模型...' })
    const result = await this.autopilot.probe()
    useGameStore.getState().setConnection({
      state: result.ok ? 'ok' : 'error',
      message: result.message,
      latencyMs: result.latencyMs,
    })
  }

  get pieceAt(): PieceType | null {
    return this.engine.current?.type ?? null
  }
}

export const runtime = new TetrisRuntime()
