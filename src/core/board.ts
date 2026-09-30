import { COLS, ROWS, type Board, type BoardCell, type PieceType } from './constants'

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<BoardCell>(COLS).fill(0))
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

export function emptyBoardLike(board: Board): Board {
  return board.map((row) => row.map(() => 0 as BoardCell))
}

/** 是否与已锁定方块或边界冲突（允许位于棋盘上方，即 row < 0） */
export function collides(board: Board, cells: Array<[number, number]>): boolean {
  for (const [r, c] of cells) {
    if (c < 0 || c >= COLS) return true
    if (r >= ROWS) return true
    if (r < 0) continue
    if (board[r][c] !== 0) return true
  }
  return false
}

export function lockInto(board: Board, cells: Array<[number, number]>, type: PieceType): void {
  for (const [r, c] of cells) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue
    board[r][c] = type
  }
}

export function findFullRows(board: Board): number[] {
  const rows: number[] = []
  for (let r = 0; r < ROWS; r += 1) {
    let full = true
    for (let c = 0; c < COLS; c += 1) {
      if (board[r][c] === 0) {
        full = false
        break
      }
    }
    if (full) rows.push(r)
  }
  return rows
}

/** 原地消行：把被消除的行移除并在顶部补空行 */
export function clearRows(board: Board, rows: number[]): void {
  if (rows.length === 0) return
  const remove = new Set(rows)
  const kept: Board = []
  for (let r = 0; r < ROWS; r += 1) {
    if (!remove.has(r)) kept.push(board[r])
  }
  while (kept.length < ROWS) kept.unshift(new Array<BoardCell>(COLS).fill(0))
  for (let r = 0; r < ROWS; r += 1) board[r] = kept[r]
}

export function boardToText(board: Board, flipRows = false): string {
  const rows = board.map((row) => row.map((cell) => (cell === 0 ? '.' : '#')).join(''))
  const ordered = flipRows ? [...rows].reverse() : rows
  return ordered.join('\n')
}

export function countFilledCells(board: Board): number {
  let total = 0
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (board[r][c] !== 0) total += 1
    }
  }
  return total
}
