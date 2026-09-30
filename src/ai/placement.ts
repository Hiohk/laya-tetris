import { COLS, ROWS, rotationName, type Board, type PieceType } from '@/core/constants'
import { cloneBoard, clearRows, collides, findFullRows, lockInto } from '@/core/board'
import { computeBoardMetrics, computeFeatures, dellacherieScore } from '@/core/metrics'
import { cellsAt, uniqueRotations } from '@/core/tetromino'
import type { PlacementOption } from './types'

/**
 * 枚举当前方块的全部合法落点：
 * 对每个（去重后的）旋转态 × 每个横向位置，从棋盘上方硬降到底，模拟锁定与消行，
 * 产出落点后的量化指标与 Dellacherie 启发式评分。约 4 × 10 = 40 次模拟，开销可忽略。
 */
export function enumeratePlacements(board: Board, type: PieceType): PlacementOption[] {
  const options: PlacementOption[] = []
  const rotations = uniqueRotations(type)

  for (const [rotation, matrix] of rotations) {
    const size = matrix.length
    for (let x = -size + 1; x < COLS; x += 1) {
      let y = -size
      while (!collides(board, cellsAt(type, rotation, x, y + 1))) y += 1
      const cells = cellsAt(type, rotation, x, y)

      const inBounds = cells.every(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS)
      if (!inBounds) continue

      const lockedBoard = cloneBoard(board)
      lockInto(lockedBoard, cells, type)
      const fullRows = findFullRows(lockedBoard)
      const erodedCells = cells.filter(([r]) => fullRows.includes(r)).length
      const bottomRow = cells.reduce((acc, [r]) => Math.max(acc, r), 0)
      const landingHeight = ROWS - bottomRow

      clearRows(lockedBoard, fullRows)

      const metrics = computeBoardMetrics(lockedBoard, fullRows.length)
      const features = computeFeatures(lockedBoard, landingHeight, fullRows.length * erodedCells)
      const score = dellacherieScore(features)

      const cols = cells.map(([, c]) => c)
      const columnRange: [number, number] = [Math.min(...cols) + 1, Math.max(...cols) + 1]

      options.push({
        id: `${type}-r${rotation}-x${x}`,
        type,
        rotation,
        x,
        columnRange,
        cells,
        lockedBoard,
        rowsCleared: fullRows,
        metrics,
        features,
        heuristicScore: score,
        rotationLabel: rotationName(type, rotation),
      })
    }
  }

  return options
}

/** 把启发式分数归一化到 0~1，用于 UI 条形图与 Mock 概率 */
export function normalizeHeuristicScores(options: Array<{ id: string; heuristicScore: number }>): Map<string, number> {
  const result = new Map<string, number>()
  if (options.length === 0) return result
  const scores = options.map((o) => o.heuristicScore)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const span = max - min
  options.forEach((o) => {
    result.set(o.id, span <= 1e-9 ? 0.5 : (o.heuristicScore - min) / span)
  })
  return result
}
