import { COLS, ROWS, type Board, type PieceType } from '@/core/constants'
import type { Matrix } from '@/core/tetromino'

/** 棋盘默认格子尺寸（实际尺寸由容器测量后覆盖） */
export const CELL = 26

/** 糖果色板 */
export const CANDY_PALETTE = {
  sky: '#3EC7F0',
  lemon: '#FFC93C',
  grape: '#B47CF7',
  mint: '#4FD98B',
  berry: '#FF7A8A',
  blue: '#5B8DEF',
  orange: '#FF9F5A',
}

/** 糖果色方块：高饱和但不刺眼 */
export const CANDY_COLORS: Record<PieceType, string> = {
  I: CANDY_PALETTE.sky,
  O: CANDY_PALETTE.lemon,
  T: CANDY_PALETTE.grape,
  S: CANDY_PALETTE.mint,
  Z: CANDY_PALETTE.berry,
  J: CANDY_PALETTE.blue,
  L: CANDY_PALETTE.orange,
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const blend = (a: number, t: number) => Math.round(a + (t - a) * amount)
  return `rgb(${blend(r, target[0])},${blend(g, target[1])},${blend(b, target[2])})`
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, [255, 255, 255], amount)
}

export function deepen(hex: string, amount: number): string {
  return mix(hex, [30, 58, 95], amount)
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export interface BlockOptions {
  alpha?: number
  ghost?: boolean
  shadow?: boolean
}

/** 单块糖果方块：圆角 + 光泽 + 底部厚度 + 柔和彩色投影 */
export function drawCandyBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string,
  options: BlockOptions = {},
): void {
  const { alpha = 1, ghost = false, shadow = true } = options
  const pad = size * 0.055
  const x = px + pad
  const y = py + pad
  const s = size - pad * 2
  const radius = size * 0.26

  ctx.save()
  ctx.globalAlpha = alpha

  if (ghost) {
    ctx.fillStyle = hexToRgba(color, 0.16)
    roundRect(ctx, x, y, s, s, radius)
    ctx.fill()
    ctx.strokeStyle = hexToRgba(color, 0.6)
    ctx.lineWidth = Math.max(1.5, size * 0.06)
    ctx.setLineDash([size * 0.16, size * 0.12])
    roundRect(ctx, x, y, s, s, radius)
    ctx.stroke()
    ctx.restore()
    return
  }

  if (shadow) {
    ctx.shadowColor = hexToRgba(color, 0.5)
    ctx.shadowBlur = size * 0.3
    ctx.shadowOffsetY = size * 0.12
  }

  const body = ctx.createLinearGradient(x, y, x, y + s)
  body.addColorStop(0, lighten(color, 0.36))
  body.addColorStop(0.55, color)
  body.addColorStop(1, deepen(color, 0.1))
  ctx.fillStyle = body
  roundRect(ctx, x, y, s, s, radius)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.save()
  roundRect(ctx, x, y, s, s, radius)
  ctx.clip()
  const depth = ctx.createLinearGradient(0, y + s * 0.55, 0, y + s)
  depth.addColorStop(0, 'rgba(30,58,95,0)')
  depth.addColorStop(1, 'rgba(30,58,95,0.24)')
  ctx.fillStyle = depth
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  roundRect(ctx, x + s * 0.15, y + s * 0.12, s * 0.66, s * 0.22, s * 0.11)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = Math.max(1, size * 0.045)
  roundRect(ctx, x + 0.5, y + 0.5, s - 1, s - 1, radius)
  ctx.stroke()

  ctx.restore()
}

/** 棋盘底板：极浅的蓝 + 柔和网格 + 顶部凹陷阴影 */
export function drawPlayField(ctx: CanvasRenderingContext2D, cell: number, w: number, h: number): void {
  // 比卡片略深一档，棋盘区域从白色卡片里分得出来
  const base = ctx.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, '#E6F1FE')
  base.addColorStop(1, '#F5FAFF')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(146,180,214,0.24)'
  ctx.lineWidth = 1
  for (let c = 1; c < COLS; c += 1) {
    ctx.beginPath()
    ctx.moveTo(c * cell + 0.5, 0)
    ctx.lineTo(c * cell + 0.5, h)
    ctx.stroke()
  }
  for (let r = 1; r < ROWS; r += 1) {
    ctx.beginPath()
    ctx.moveTo(0, r * cell + 0.5)
    ctx.lineTo(w, r * cell + 0.5)
    ctx.stroke()
  }

  const top = ctx.createLinearGradient(0, 0, 0, cell * 2.4)
  top.addColorStop(0, 'rgba(120,160,200,0.16)')
  top.addColorStop(1, 'rgba(120,160,200,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, w, cell * 2.4)
}

export function drawBoard(ctx: CanvasRenderingContext2D, board: Board, cell: number, alpha = 1): void {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const type = board[r][c]
      if (type === 0) continue
      drawCandyBlock(ctx, c * cell, r * cell, cell, CANDY_COLORS[type], { alpha })
    }
  }
}

export function drawCells(
  ctx: CanvasRenderingContext2D,
  cells: Array<[number, number]>,
  cell: number,
  type: PieceType,
  options: BlockOptions = {},
): void {
  const color = CANDY_COLORS[type]
  cells.forEach(([r, c]) => {
    if (r < 0) return
    drawCandyBlock(ctx, c * cell, r * cell, cell, color, options)
  })
}

/** 虚线框：标记模型选中的落点范围 */
export function drawDashedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.setLineDash([7, 5])
  roundRect(ctx, x, y, w, h, 10)
  ctx.stroke()
  ctx.restore()
}

/** 小尺寸预览（HOLD / NEXT）：按矩阵实际占位裁剪 */
export function drawPiecePreview(
  ctx: CanvasRenderingContext2D,
  matrix: Matrix,
  cell: number,
  type: PieceType,
  offsetX: number,
  offsetY: number,
): void {
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix[r].length; c += 1) {
      if (!matrix[r][c]) continue
      drawCandyBlock(ctx, offsetX + c * cell, offsetY + r * cell, cell, CANDY_COLORS[type], { shadow: false })
    }
  }
}

export function matrixBounds(matrix: Matrix): { rows: number; cols: number; top: number; left: number } {
  let top = matrix.length
  let bottom = -1
  let left = matrix[0].length
  let right = -1
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix[r].length; c += 1) {
      if (!matrix[r][c]) continue
      top = Math.min(top, r)
      bottom = Math.max(bottom, r)
      left = Math.min(left, c)
      right = Math.max(right, c)
    }
  }
  return { rows: bottom - top + 1, cols: right - left + 1, top, left }
}
