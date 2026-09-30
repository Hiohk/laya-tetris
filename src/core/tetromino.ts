import type { PieceType } from './constants'

export type Matrix = number[][]

const BASE_SHAPES: Record<PieceType, Matrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

export function rotateMatrix(m: Matrix): Matrix {
  const size = m.length
  const out: Matrix = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      out[c][size - 1 - r] = m[r][c]
    }
  }
  return out
}

const rotationCache = new Map<PieceType, Matrix[]>()

export function rotationsOf(type: PieceType): Matrix[] {
  const cached = rotationCache.get(type)
  if (cached) return cached
  const list: Matrix[] = [BASE_SHAPES[type]]
  for (let i = 1; i < 4; i += 1) list.push(rotateMatrix(list[i - 1]))
  rotationCache.set(type, list)
  return list
}

export function matrixAt(type: PieceType, rotation: number): Matrix {
  return rotationsOf(type)[((rotation % 4) + 4) % 4]
}

/**
 * 形状指纹：只看「填充格的相对排布」，忽略整体平移。
 *
 * 不能直接用矩阵字符串 —— `rotateMatrix` 保持外框尺寸，180° 对称的方块
 * （I / S / Z）转两下之后填的格子完全相同、只是在外框里平移了，
 * 矩阵字符串并不相等，去重就会失效：枚举量直接翻倍，
 * Top-N 候选里会出现同一个落点占两个名额，白白多花一次模型请求。
 */
export function shapeKey(m: Matrix): string {
  const cells = matrixCells(m)
  if (cells.length === 0) return ''
  const minRow = Math.min(...cells.map(([r]) => r))
  const minCol = Math.min(...cells.map(([, c]) => c))
  return cells
    .map(([r, c]) => `${r - minRow},${c - minCol}`)
    .sort()
    .join(' ')
}

/** 去重后的旋转态：返回 [旋转索引, 矩阵] 列表 */
export function uniqueRotations(type: PieceType): Array<[number, Matrix]> {
  const seen = new Set<string>()
  const out: Array<[number, Matrix]> = []
  rotationsOf(type).forEach((m, index) => {
    const key = shapeKey(m)
    if (seen.has(key)) return
    seen.add(key)
    out.push([index, m])
  })
  return out
}

/** 矩阵内的填充格坐标（相对矩阵左上角），便于预览渲染 */
export function matrixCells(m: Matrix): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let r = 0; r < m.length; r += 1) {
    for (let c = 0; c < m[r].length; c += 1) {
      if (m[r][c]) cells.push([r, c])
    }
  }
  return cells
}

/** 棋盘绝对坐标下的格子列表 */
export function cellsAt(type: PieceType, rotation: number, x: number, y: number): Array<[number, number]> {
  const m = matrixAt(type, rotation)
  const out: Array<[number, number]> = []
  for (let r = 0; r < m.length; r += 1) {
    for (let c = 0; c < m[r].length; c += 1) {
      if (m[r][c]) out.push([y + r, x + c])
    }
  }
  return out
}

type KickTable = Record<string, Array<[number, number]>>

/** SRS 踢墙表，y 向上为正 */
const KICKS_JLSTZ: KickTable = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
}

const KICKS_I: KickTable = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
}

export function kickOffsets(type: PieceType, from: number, to: number): Array<[number, number]> {
  if (type === 'O') return [[0, 0]]
  const table = type === 'I' ? KICKS_I : KICKS_JLSTZ
  return table[`${from}>${to}`] ?? [[0, 0]]
}
