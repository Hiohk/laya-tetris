import { COLS, ROWS, type Board } from './constants'

/** 与 Laya 协议 board_metrics 字段一一对应 */
export interface BoardMetrics {
  lines_cleared: number
  holes: number
  max_height: number
  bumpiness: number
  well_depths: number[]
}

export interface FeatureBreakdown {
  landingHeight: number
  erodedPieceCells: number
  rowTransitions: number
  colTransitions: number
  holes: number
  wellSums: number
}

export const DELLACHERIE_WEIGHTS = {
  landingHeight: -4.500158825082766,
  erodedPieceCells: 3.4181268101392694,
  rowTransitions: -3.2178882868487753,
  colTransitions: -9.348695305445199,
  holes: -7.899265427351652,
  wellSums: -3.3855972247263626,
}

/** 每列堆叠高度（从底部算起，0 表示该列为空） */
export function columnHeights(board: Board): number[] {
  const heights = new Array<number>(COLS).fill(0)
  for (let c = 0; c < COLS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      if (board[r][c] !== 0) {
        heights[c] = ROWS - r
        break
      }
    }
  }
  return heights
}

export function countHoles(board: Board, heights?: number[]): number {
  const h = heights ?? columnHeights(board)
  let holes = 0
  for (let c = 0; c < COLS; c += 1) {
    const top = ROWS - h[c]
    let blocked = false
    for (let r = 0; r < ROWS; r += 1) {
      if (r < top) continue
      if (board[r][c] !== 0) blocked = true
      else if (blocked) holes += 1
    }
  }
  return holes
}

export function maxHeight(heights: number[]): number {
  return heights.reduce((acc, v) => Math.max(acc, v), 0)
}

export function bumpiness(heights: number[]): number {
  let sum = 0
  for (let c = 0; c < COLS - 1; c += 1) sum += Math.abs(heights[c] - heights[c + 1])
  return sum
}

/** 井：左右两侧都高于自身高度的空列，深度 = min(两侧高度) - 自身高度 */
export function wellDepths(heights: number[]): number[] {
  const depths = new Array<number>(COLS).fill(0)
  for (let c = 0; c < COLS; c += 1) {
    const left = c > 0 ? heights[c - 1] : 0
    const right = c < COLS - 1 ? heights[c + 1] : 0
    const around = Math.min(left, right)
    if (around > heights[c]) depths[c] = around - heights[c]
  }
  return depths
}

/** Dellacherie 的 well sums：深度为 d 的井贡献 1+2+...+d */
export function wellSums(board: Board, heights?: number[]): number {
  const h = heights ?? columnHeights(board)
  let sum = 0
  for (let c = 0; c < COLS; c += 1) {
    let run = 0
    for (let r = 0; r < ROWS; r += 1) {
      const filled = board[r][c] !== 0
      const leftHigher = c === 0 ? false : h[c - 1] > ROWS - 1 - r
      const rightHigher = c === COLS - 1 ? false : h[c + 1] > ROWS - 1 - r
      if (!filled && leftHigher && rightHigher) {
        run += 1
        sum += run
      } else {
        run = 0
      }
    }
  }
  return sum
}

export function rowTransitions(board: Board): number {
  let transitions = 0
  for (let r = 0; r < ROWS; r += 1) {
    let prev = 1
    for (let c = 0; c < COLS; c += 1) {
      const cur = board[r][c] !== 0 ? 1 : 0
      if (cur !== prev) transitions += 1
      prev = cur
    }
    if (prev === 0) transitions += 1
  }
  return transitions
}

export function colTransitions(board: Board): number {
  let transitions = 0
  for (let c = 0; c < COLS; c += 1) {
    let prev = 0
    for (let r = 0; r < ROWS; r += 1) {
      const cur = board[r][c] !== 0 ? 1 : 0
      if (cur !== prev) transitions += 1
      prev = cur
    }
    if (prev === 0) transitions += 1
  }
  return transitions
}

export function computeFeatures(board: Board, landingHeight: number, erodedPieceCells: number): FeatureBreakdown {
  const heights = columnHeights(board)
  return {
    landingHeight,
    erodedPieceCells,
    rowTransitions: rowTransitions(board),
    colTransitions: colTransitions(board),
    holes: countHoles(board, heights),
    wellSums: wellSums(board, heights),
  }
}

export function dellacherieScore(f: FeatureBreakdown): number {
  return (
    DELLACHERIE_WEIGHTS.landingHeight * f.landingHeight +
    DELLACHERIE_WEIGHTS.erodedPieceCells * f.erodedPieceCells +
    DELLACHERIE_WEIGHTS.rowTransitions * f.rowTransitions +
    DELLACHERIE_WEIGHTS.colTransitions * f.colTransitions +
    DELLACHERIE_WEIGHTS.holes * f.holes +
    DELLACHERIE_WEIGHTS.wellSums * f.wellSums
  )
}

/** 落点落定后的量化指标，用于协议 board_metrics 与看板展示 */
export function computeBoardMetrics(board: Board, linesCleared: number): BoardMetrics {
  const heights = columnHeights(board)
  return {
    lines_cleared: linesCleared,
    holes: countHoles(board, heights),
    max_height: maxHeight(heights),
    bumpiness: bumpiness(heights),
    well_depths: wellDepths(heights),
  }
}
