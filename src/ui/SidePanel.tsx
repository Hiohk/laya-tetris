import { useEffect, useRef } from 'react'
import { Repeat2, Sparkles } from 'lucide-react'
import type { PieceType } from '@/core/constants'
import { matrixAt } from '@/core/tetromino'
import { cn } from '@/lib/utils'
import { runtime } from '@/store/runtime'
import { useGameStore } from '@/store/useGameStore'
import { drawPiecePreview, matrixBounds } from './render'

/** 按方块实际占位裁剪的小预览 */
export function MiniPiece({ type, cell, dim = false }: { type: PieceType; cell: number; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const matrix = matrixAt(type, 0)
    const bounds = matrixBounds(matrix)
    const width = bounds.cols * cell
    const height = bounds.rows * cell
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    drawPiecePreview(ctx, matrix, cell, type, -bounds.left * cell, -bounds.top * cell)
  }, [type, cell])

  return <canvas ref={ref} className={cn('block', dim && 'opacity-70')} />
}

/** 侧栏：下一块预览 + Hold 区 + 交换 / AI 托管 */
export function SidePanel() {
  const nextTypes = useGameStore((state) => state.nextTypes)
  const hold = useGameStore((state) => state.hold)
  const mode = useGameStore((state) => state.mode)
  const setMode = useGameStore((state) => state.setMode)

  const auto = mode !== 'manual'
  const [first, ...rest] = nextTypes.slice(0, 3)

  const toggleAuto = () => {
    const next = auto ? 'manual' : 'laya'
    setMode(next)
    runtime.onModeChanged()
    // 关掉托管也要立刻能玩，所以同样自动开局
    if (useGameStore.getState().status !== 'running') runtime.start()
  }

  return (
    <div className="flex w-[84px] shrink-0 flex-col gap-2 self-stretch sm:w-[96px]">
      <div className="panel flex flex-[1.5] flex-col items-center gap-2 px-2 py-2.5">
        <span className="label-key">Next</span>
        <div className="flex flex-1 items-center justify-center">
          {first ? <MiniPiece type={first} cell={13} /> : null}
        </div>
        <div className="flex w-full flex-col items-center gap-1.5 rounded-[16px] bg-cloud-100/80 px-1.5 py-2">
          {rest.map((type, index) => (
            <div key={`${type}-${index}`} className="flex h-8 items-center justify-center">
              <MiniPiece type={type} cell={7} dim />
            </div>
          ))}
        </div>
      </div>

      <div className="panel flex flex-1 flex-col items-center justify-center gap-2 px-2 py-2.5">
        <span className="label-key">Hold</span>
        <div className="flex items-center justify-center">
          {hold ? <MiniPiece type={hold} cell={12} /> : <span className="text-[12px] text-candy-muted/80">空</span>}
        </div>
        <button
          type="button"
          onClick={() => runtime.manualHold()}
          title="交换暂存方块（会自动切到人工模式）"
          className="clay flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold text-candy-ink"
        >
          <Repeat2 className="h-4 w-4" />
          交换
        </button>
      </div>

      <button
        type="button"
        onClick={toggleAuto}
        className={cn(
          'clay flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-bold',
          auto ? 'text-candy-deep [background:linear-gradient(180deg,#4FD98B,#2FB86C)]' : 'text-candy-muted',
        )}
      >
        <Sparkles className={cn('h-3.5 w-3.5', auto && 'fill-candy-deep')} />
        {auto ? '托管中' : 'AI 托管'}
      </button>
    </div>
  )
}
