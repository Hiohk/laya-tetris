import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { COLS, ROWS } from '@/core/constants'
import { runtime } from '@/store/runtime'
import { useGameStore } from '@/store/useGameStore'
import type { GameEngine } from '@/core/engine'
import type { EvaluatedCandidate } from '@/ai/types'
import { CANDY_COLORS, drawBoard, drawCells, drawDashedBox, drawPlayField } from './render'

interface StageSize {
  cell: number
  width: number
  height: number
}

function cellBounds(cells: Array<[number, number]>): { top: number; bottom: number; left: number; right: number } {
  const rows = cells.map(([r]) => r)
  const cols = cells.map(([, c]) => c)
  return {
    top: Math.min(...rows),
    bottom: Math.max(...rows),
    left: Math.min(...cols),
    right: Math.max(...cols),
  }
}

/**
 * 棋盘：尺寸随容器自适应，每帧直接读引擎状态（不经过 React），
 * 消行粒子/闪光/震动由 runtime.effects 提供，并支持滑动手势。
 */
export function BoardCanvas({
  onMove,
  onSoftDrop,
  onRotate,
  onHardDrop,
}: {
  onMove: (dx: number) => void
  onSoftDrop: () => void
  onRotate: () => void
  onHardDrop: () => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number; time: number } | null>(null)
  const [size, setSize] = useState<StageSize>({ cell: 24, width: COLS * 24, height: ROWS * 24 })
  const showOverlay = useGameStore((state) => state.settings.showCandidateOverlay)
  const overlayFlag = useRef(showOverlay)
  overlayFlag.current = showOverlay

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const rect = wrap.getBoundingClientRect()
      const cell = Math.max(8, Math.floor(Math.min(rect.width / COLS, rect.height / ROWS)))
      setSize({ cell, width: cell * COLS, height: cell * ROWS })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr

    let raf = 0
    const frame = () => {
      const now = performance.now()
      const shake = runtime.effects.shakeOffset(now)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.width, size.height)
      ctx.save()
      ctx.translate(shake.x, shake.y)

      drawPlayField(ctx, size.cell, size.width, size.height)
      drawBoard(ctx, runtime.engine.board, size.cell)

      const overlay = runtime.overlay
      const phase = useGameStore.getState().phase
      const targetHighlight = phase === 'preview' || phase === 'travel' || phase === 'hover'

      if (overlayFlag.current && overlay.candidates.length > 0) {
        drawCandidates(ctx, overlay.candidates, overlay.selectedId, targetHighlight, now, size.cell)
      }

      const selected = overlay.candidates.find((candidate) => candidate.id === overlay.selectedId)
      if (selected && targetHighlight) drawTargetGuide(ctx, runtime.engine, selected, now, size.cell)

      const piece = runtime.engine.current
      if (piece) {
        const ghost = runtime.engine.cellsOf({ ...piece, y: runtime.engine.ghostY() })
        drawCells(ctx, ghost, size.cell, piece.type, { ghost: true, alpha: 0.85 })
        drawCells(ctx, runtime.engine.currentCells(), size.cell, piece.type)
      }

      runtime.effects.draw(ctx, size.cell)
      ctx.restore()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size])

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const threshold = 20

    const dx = event.clientX - drag.x
    if (Math.abs(dx) >= threshold) {
      const steps = Math.trunc(dx / threshold)
      for (let i = 0; i < Math.abs(steps); i += 1) onMove(Math.sign(steps))
      drag.x += steps * threshold
    }

    const dy = event.clientY - drag.y
    if (dy >= threshold) {
      const steps = Math.trunc(dy / threshold)
      for (let i = 0; i < steps; i += 1) onSoftDrop()
      drag.y += steps * threshold
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    const totalDx = Math.abs(event.clientX - drag.startX)
    const totalDy = event.clientY - drag.startY
    const elapsed = performance.now() - drag.time

    // 轻点旋转，快速下滑直落
    if (totalDx < 12 && totalDy < 12 && elapsed < 280) {
      onRotate()
      return
    }
    if (totalDy > 70 && elapsed < 260) onHardDrop()
  }

  return (
    <div ref={wrapRef} className="flex min-h-[240px] flex-1 items-center justify-center">
      <canvas
        ref={canvasRef}
        className="block rounded-[18px] ring-1 ring-candy-line"
        style={{ width: size.width, height: size.height, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (dragRef.current = null)}
      />
    </div>
  )
}

/** 候选落点叠加：未选中时半透明铺开，选定后只留目标落点 */
function drawCandidates(
  ctx: CanvasRenderingContext2D,
  candidates: EvaluatedCandidate[],
  selectedId: string,
  targetHighlight: boolean,
  now: number,
  cell: number,
): void {
  const locked = selectedId !== ''
  const pulse = 0.5 + 0.5 * Math.sin(now / 300)

  candidates.forEach((candidate) => {
    const isSelected = candidate.id === selectedId

    if (!isSelected && locked) {
      drawCells(ctx, candidate.cells, cell, candidate.type, { alpha: targetHighlight ? 0.06 : 0.14 })
      return
    }
    if (candidate.status === 'pending') {
      drawCells(ctx, candidate.cells, cell, candidate.type, { alpha: 0.18 + pulse * 0.14 })
      return
    }
    if (candidate.status === 'error') {
      drawCells(ctx, candidate.cells, cell, candidate.type, { alpha: 0.08 })
      return
    }
    const noul = candidate.noul ?? 0.3
    drawCells(ctx, candidate.cells, cell, candidate.type, {
      alpha: isSelected ? 0.34 + pulse * 0.16 : 0.2 + noul * 0.28,
    })
  })
}

/** 目标落点指示：虚线落点框 + 指向落点的引导线 */
function drawTargetGuide(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  selected: EvaluatedCandidate,
  now: number,
  cell: number,
): void {
  const bounds = cellBounds(selected.cells)
  const pulse = 0.5 + 0.5 * Math.sin(now / 300)
  const color = CANDY_COLORS[selected.type]

  drawDashedBox(
    ctx,
    bounds.left * cell + 2,
    bounds.top * cell + 2,
    (bounds.right - bounds.left + 1) * cell - 4,
    (bounds.bottom - bounds.top + 1) * cell - 4,
    color,
    0.5 + pulse * 0.45,
  )

  const piece = engine.current
  if (!piece) return
  const pieceBounds = cellBounds(engine.currentCells())
  const pieceCenter = ((pieceBounds.left + pieceBounds.right + 1) / 2) * cell
  const targetCenter = ((bounds.left + bounds.right + 1) / 2) * cell
  const landingY = (bounds.bottom + 1) * cell - 2

  ctx.save()
  ctx.globalAlpha = 0.35 + pulse * 0.35
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.setLineDash([5, 6])
  ctx.beginPath()
  ctx.moveTo(pieceCenter, Math.max(0, pieceBounds.bottom + 1) * cell)
  ctx.lineTo(targetCenter, landingY)
  ctx.stroke()
  ctx.restore()
}
