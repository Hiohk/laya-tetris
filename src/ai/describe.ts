import type { PieceType } from '@/core/constants'
import type { PlacementOption } from './types'

const PIECE_LABEL: Record<PieceType, string> = {
  I: 'I 长条',
  O: 'O 方块',
  T: 'T 形',
  S: 'S 形',
  Z: 'Z 形',
  J: 'J 形',
  L: 'L 形',
}

/**
 * 生成送给 Laya 的中文落点陈述。
 * 协议要求：不要把坐标直接丢给模型，而是翻译成「这个落点意味着什么」，
 * 并且必须同时呈现正面与负面特征，让模型校准出的概率能反映真实权衡。
 */
export function describePlacement(
  type: PieceType,
  option: PlacementOption,
  nextPieces: PieceType[] = [],
): string {
  const [left, right] = option.columnRange
  const columnText = left === right ? `第 ${left} 列` : `第 ${left}~${right} 列`
  const { metrics, rowsCleared } = option

  const lines =
    rowsCleared.length > 0
      ? `消除 ${rowsCleared.length} 行（第 ${rowsCleared.map((r) => r + 1).join('、')} 行）`
      : '未消除任何行'

  const holeText = metrics.holes === 0 ? '没有留下空洞' : `留下 ${metrics.holes} 个空洞`

  const heights = option.lockedBoard
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some((cell) => cell !== 0))
  const topRow = heights.length > 0 ? heights[0].index + 1 : 20

  const deepestWell = metrics.well_depths.reduce((acc, depth) => Math.max(acc, depth), 0)
  const wellText =
    deepestWell >= 4
      ? `存在深度 ${deepestWell} 的竖井（可容纳 I 长条消四行）`
      : deepestWell > 0
        ? `存在深度 ${deepestWell} 的小井`
        : '没有深井'

  const pros: string[] = []
  const cons: string[] = []

  if (rowsCleared.length > 0) pros.push(`消除 ${rowsCleared.length} 行`)
  if (metrics.holes === 0) pros.push('不留空洞')
  if (metrics.bumpiness <= 4) pros.push('表面平整')
  if (metrics.max_height <= 8) pros.push('堆叠很低')
  if (deepestWell >= 4) pros.push('为 I 长条预留了竖井')

  if (metrics.holes > 0) cons.push(`制造 ${metrics.holes} 个空洞`)
  if (metrics.bumpiness > 8) cons.push(`相邻列高度差达 ${metrics.bumpiness}`)
  if (metrics.max_height >= 14) cons.push(`最高处已达到 ${metrics.max_height} 层，接近顶部`)
  if (deepestWell > 0 && deepestWell < 4) cons.push(`留下深度 ${deepestWell} 的浅井难以填补`)
  if (rowsCleared.length === 0 && metrics.holes === 0 && metrics.bumpiness <= 4) {
    pros.push('为后续方块保留了平整空间')
  }

  const nextText = nextPieces.length > 0 ? `（后续方块：${nextPieces.join('、')}）` : ''

  return [
    `${PIECE_LABEL[type]}以「${option.rotationLabel}」的姿态落在${columnText}，落点高度为 ${option.features.landingHeight} 层${nextText}。`,
    `落点后：${lines}，${holeText}；最高堆叠 ${metrics.max_height} 层（共 20 层），相邻列高度差之和为 ${metrics.bumpiness}，${wellText}，顶部空余到第 ${topRow} 行。`,
    pros.length > 0 ? `优势：${pros.join('、')}。` : '',
    cons.length > 0 ? `风险：${cons.join('、')}。` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function pieceLabel(type: PieceType): string {
  return PIECE_LABEL[type]
}
