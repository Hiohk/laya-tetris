import {
  COLS,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  ROWS,
  SCORE_TABLE,
  SPAWN,
  gravityIntervalMs,
  type Board,
  type PieceType,
} from './constants'
import { cellsAt, kickOffsets, matrixAt } from './tetromino'
import { clearRows, cloneBoard, collides, createBoard, findFullRows, lockInto } from './board'
import { createBag, createRandom, randomSeed } from './rng'

export type GameStatus = 'ready' | 'running' | 'paused' | 'over'

export interface ActivePiece {
  type: PieceType
  rotation: number
  x: number
  y: number
  pieceId: number
}

export type EngineEvent =
  | { kind: 'spawn'; pieceId: number; type: PieceType }
  | { kind: 'lock'; pieceId: number; type: PieceType; clearedRows: number[]; lines: number; combo: number }
  | { kind: 'move' }
  | { kind: 'rotate'; direction: number }
  | { kind: 'hold'; type: PieceType }
  | { kind: 'levelup'; level: number }
  | { kind: 'gameover'; pieces: number; lines: number; score: number }

type Listener = (event: EngineEvent) => void

/** 硬降轨迹：供画布绘制拖影与落定冲击波 */
export interface DropTrail {
  type: PieceType
  fromCells: Array<[number, number]>
  toCells: Array<[number, number]>
  distance: number
  at: number
}

export interface EngineSnapshot {
  board: Board
  current: ActivePiece | null
  nextTypes: PieceType[]
  status: GameStatus
  score: number
  lines: number
  level: number
  pieces: number
}

export class GameEngine {
  board: Board = createBoard()
  current: ActivePiece | null = null
  queue: PieceType[] = []
  hold: PieceType | null = null
  canHold = true
  status: GameStatus = 'ready'
  score = 0
  lines = 0
  level = 1
  pieces = 0
  combo = -1

  /** 最近一次消行，用于画布高亮动画 */
  lastClearedRows: number[] = []
  lastClearAt = 0
  /** 最近锁定的一批格子，用于落子闪光 */
  lastLockedCells: Array<[number, number]> = []
  lastLockAt = 0
  /** 最近一次硬降的起止位置，用于拖影动画 */
  lastDrop: DropTrail | null = null

  /** 速度倍率：> 1 表示更快 */
  speedScale = 1

  private spawnCount = 0
  private gravityAcc = 0
  private lockAcc = 0
  private lockResets = 0
  private listeners = new Set<Listener>()
  private nextBag: () => PieceType

  private seed = randomSeed()

  constructor(seed?: number) {
    this.nextBag = createBag(createRandom(seed ?? this.seed))
    this.reset(seed)
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: EngineEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }

  reset(seed?: number): void {
    this.seed = seed ?? randomSeed()
    this.nextBag = createBag(createRandom(this.seed))
    this.board = createBoard()
    this.queue = []
    this.refillQueue(6)
    this.hold = null
    this.canHold = true
    this.status = 'ready'
    this.score = 0
    this.lines = 0
    this.level = 1
    this.pieces = 0
    this.combo = -1
    this.spawnCount = 0
    this.gravityAcc = 0
    this.lockAcc = 0
    this.lockResets = 0
    this.lastClearedRows = []
    this.lastLockedCells = []
    this.lastClearAt = 0
    this.lastDrop = null
    this.current = null
  }

  private refillQueue(size: number): void {
    while (this.queue.length < size) this.queue.push(this.nextBag())
  }

  get nextTypes(): PieceType[] {
    return this.queue.slice(0, 5)
  }

  start(): void {
    if (this.status === 'over') return
    if (!this.current) this.spawn()
    this.status = 'running'
  }

  pause(): void {
    if (this.status === 'running') this.status = 'paused'
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'running'
  }

  togglePause(): void {
    if (this.status === 'paused') this.resume()
    else this.pause()
  }

  /** 生成新方块，返回是否成功（失败即游戏结束） */
  spawn(type?: PieceType): boolean {
    this.refillQueue(6)
    const nextType = type ?? (this.queue.shift() as PieceType)
    this.refillQueue(6)
    this.spawnCount += 1
    const rotation = 0
    const spec = SPAWN[nextType]
    const piece: ActivePiece = { type: nextType, rotation, x: spec.x, y: spec.y, pieceId: this.spawnCount }
    const cells = this.cellsOf(piece)
    if (collides(this.board, cells)) {
      this.current = piece
      this.status = 'over'
      this.emit({ kind: 'gameover', pieces: this.pieces, lines: this.lines, score: this.score })
      return false
    }
    this.current = piece
    this.gravityAcc = 0
    this.lockAcc = 0
    this.lockResets = 0
    this.emit({ kind: 'spawn', pieceId: piece.pieceId, type: piece.type })
    return true
  }

  cellsOf(piece: ActivePiece): Array<[number, number]> {
    return cellsAt(piece.type, piece.rotation, piece.x, piece.y)
  }

  currentCells(): Array<[number, number]> {
    return this.current ? this.cellsOf(this.current) : []
  }

  ghostY(): number {
    if (!this.current) return 0
    let y = this.current.y
    while (!collides(this.board, cellsAt(this.current.type, this.current.rotation, this.current.x, y + 1))) y += 1
    return y
  }

  canMove(dx: number, dy: number): boolean {
    if (!this.current) return false
    const p = this.current
    return !collides(this.board, cellsAt(p.type, p.rotation, p.x + dx, p.y + dy))
  }

  move(dx: number): boolean {
    if (!this.current || !this.canMove(dx, 0)) return false
    this.current.x += dx
    this.registerLockReset()
    this.emit({ kind: 'move' })
    return true
  }

  private registerLockReset(): void {
    if (this.lockAcc > 0 && this.lockResets < MAX_LOCK_RESETS) {
      this.lockAcc = 0
      this.lockResets += 1
    }
  }

  rotate(direction = 1): boolean {
    const p = this.current
    if (!p) return false
    const to = ((p.rotation + (direction > 0 ? 1 : 3)) % 4 + 4) % 4
    const kicks = kickOffsets(p.type, p.rotation, to)
    for (const [kx, ky] of kicks) {
      const cells = cellsAt(p.type, to, p.x + kx, p.y - ky)
      if (!collides(this.board, cells)) {
        p.rotation = to
        p.x += kx
        p.y -= ky
        this.registerLockReset()
        this.emit({ kind: 'rotate', direction })
        return true
      }
    }
    return false
  }

  softDrop(): boolean {
    if (!this.current || !this.canMove(0, 1)) {
      this.lockAcc = LOCK_DELAY_MS
      return false
    }
    this.current.y += 1
    this.score += 1
    this.gravityAcc = 0
    this.lockAcc = 0
    this.emit({ kind: 'move' })
    return true
  }

  hardDrop(): void {
    const p = this.current
    if (!p) return
    const fromCells = this.cellsOf(p)
    let dropped = 0
    while (this.canMove(0, 1)) {
      p.y += 1
      dropped += 1
    }
    this.score += dropped * 2
    this.lastDrop = {
      type: p.type,
      fromCells,
      toCells: this.cellsOf(p),
      distance: dropped,
      at: performance.now(),
    }
    this.lock()
  }

  holdPiece(): boolean {
    if (!this.current || !this.canHold) return false
    const currentType = this.current.type
    const stored = this.hold
    this.hold = currentType
    this.canHold = false
    if (stored) {
      this.spawn(stored)
      this.emit({ kind: 'hold', type: stored })
    } else {
      // 暂存槽为空时，当前方块存入槽内，直接从队列取下一个方块
      this.spawn()
      this.emit({ kind: 'hold', type: currentType })
    }
    return true
  }

  /** 立即执行一步重力（单步按钮用） */
  stepDown(): void {
    if (!this.current) return
    if (this.canMove(0, 1)) {
      this.current.y += 1
      this.gravityAcc = 0
      this.lockAcc = 0
    } else {
      this.lock()
    }
  }

  lock(): void {
    const p = this.current
    if (!p) return
    const cells = this.cellsOf(p)
    lockInto(this.board, cells, p.type)
    this.lastLockedCells = cells.filter(([r]) => r >= 0)
    this.lastLockAt = performance.now()

    const rows = findFullRows(this.board)
    clearRows(this.board, rows)
    const cleared = rows.length
    this.lastClearedRows = rows
    if (cleared > 0) this.lastClearAt = performance.now()

    if (cleared > 0) {
      this.combo += 1
      const base = SCORE_TABLE[cleared] ?? 800
      this.score += base * this.level + (this.combo > 0 ? 50 * this.combo * this.level : 0)
      this.lines += cleared
      const nextLevel = 1 + Math.floor(this.lines / 10)
      if (nextLevel !== this.level) {
        this.level = nextLevel
        this.emit({ kind: 'levelup', level: nextLevel })
      }
    } else {
      this.combo = -1
    }

    this.pieces += 1
    this.canHold = true
    this.emit({ kind: 'lock', pieceId: p.pieceId, type: p.type, clearedRows: rows, lines: cleared, combo: this.combo })

    if (this.status !== 'over') this.spawn()
  }

  tick(dtMs: number): void {
    if (this.status !== 'running' || !this.current) return
    const interval = gravityIntervalMs(this.level) / Math.max(0.25, this.speedScale)
    this.gravityAcc += dtMs
    while (this.gravityAcc >= interval) {
      this.gravityAcc -= interval
      if (this.canMove(0, 1)) {
        this.current.y += 1
        this.lockAcc = 0
      } else {
        break
      }
    }

    if (!this.canMove(0, 1)) {
      this.lockAcc += dtMs
      if (this.lockAcc >= LOCK_DELAY_MS) this.lock()
    } else {
      this.lockAcc = 0
    }
  }

  snapshot(): EngineSnapshot {
    return {
      board: cloneBoard(this.board),
      current: this.current ? { ...this.current } : null,
      nextTypes: this.nextTypes,
      status: this.status,
      score: this.score,
      lines: this.lines,
      level: this.level,
      pieces: this.pieces,
    }
  }

  /** 供 AI 枚举使用：把当前方块硬降到位所需的行数 */
  dropDistance(): number {
    if (!this.current) return 0
    return this.ghostY() - this.current.y
  }

  get columns(): number {
    return COLS
  }

  get rows(): number {
    return ROWS
  }

  /** 矩阵原点可用列范围（枚举落点时用） */
  static readonly COLS = COLS
  static readonly ROWS = ROWS
  static readonly matrixAt = matrixAt
}
