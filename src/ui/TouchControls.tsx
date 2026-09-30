import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Pause,
  Play,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/store/useGameStore'

/** 按住可连续触发的按键（左右移动、软降） */
function RepeatButton({
  onTrigger,
  className,
  children,
  repeat = true,
  delay = 160,
  interval = 70,
  label,
}: {
  onTrigger: () => void
  className?: string
  children: ReactNode
  repeat?: boolean
  delay?: number
  interval?: number
  label: string
}) {
  const [pressing, setPressing] = useState(false)
  const triggerRef = useRef(onTrigger)
  triggerRef.current = onTrigger

  useEffect(() => {
    if (!pressing) return
    const stop = () => setPressing(false)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [pressing])

  useEffect(() => {
    if (!pressing || !repeat) return
    let timer = 0
    const delayId = window.setTimeout(() => {
      timer = window.setInterval(() => triggerRef.current(), interval)
    }, delay)
    return () => {
      window.clearTimeout(delayId)
      window.clearInterval(timer)
    }
  }, [pressing, repeat, delay, interval])

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        triggerRef.current()
        setPressing(true)
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={cn('tap-none clay flex items-center justify-center', className)}
    >
      {children}
    </button>
  )
}

/** 底部控制区：直落 / 暂停 / 音效 + 触控方向键 */
export function TouchControls({
  onLeft,
  onRight,
  onSoftDrop,
  onRotate,
  onHardDrop,
  onTogglePause,
}: {
  onLeft: () => void
  onRight: () => void
  onSoftDrop: () => void
  onRotate: () => void
  onHardDrop: () => void
  onTogglePause: () => void
}) {
  const status = useGameStore((state) => state.status)
  const mode = useGameStore((state) => state.mode)
  const soundOn = useGameStore((state) => state.settings.soundOn)
  const setSettings = useGameStore((state) => state.setSettings)
  const running = status === 'running'
  const manual = mode === 'manual'

  return (
    <div className="panel flex flex-col gap-3 px-3 py-3">
      {manual ? null : (
        <p className="rounded-full bg-candy-mint/18 px-3 py-1.5 text-center text-[13px] font-medium text-[#1F8B58]">
          AI 托管中 · 点按方向键或滑动棋盘即可随时接管
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onHardDrop}
          className="tap-none clay flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold text-candy-ink"
        >
          <ArrowDownToLine className="h-3.5 w-3.5 text-[#12708F]" />
          直落
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          className="tap-none clay flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold text-candy-ink"
        >
          {running ? <Pause className="h-3.5 w-3.5 text-[#6534B8]" /> : <Play className="h-3.5 w-3.5 text-[#6534B8]" />}
          {running ? '暂停' : '继续'}
        </button>
        <button
          type="button"
          onClick={() => setSettings({ soundOn: !soundOn })}
          className="tap-none clay flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[13px] font-bold text-candy-ink"
        >
          {soundOn ? (
            <Volume2 className="h-3.5 w-3.5 text-[#1F8B58]" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-candy-muted" />
          )}
          {soundOn ? '音效' : '静音'}
        </button>
      </div>

      <div className="flex items-center justify-center gap-3">
        <RepeatButton label="左移" onTrigger={onLeft} className="h-[62px] w-[62px] rounded-full text-candy-ink">
          <ArrowLeft className="h-7 w-7" />
        </RepeatButton>

        <RepeatButton label="软降" onTrigger={onSoftDrop} className="h-[62px] w-[62px] rounded-full text-candy-ink">
          <ChevronDown className="h-8 w-8" />
        </RepeatButton>

        <RepeatButton label="右移" onTrigger={onRight} className="h-[62px] w-[62px] rounded-full text-candy-ink">
          <ArrowRight className="h-7 w-7" />
        </RepeatButton>

        <RepeatButton
          label="旋转"
          repeat={false}
          onTrigger={onRotate}
          className="clay-primary sheen relative h-[72px] w-[72px] rounded-full"
        >
          <RotateCw className="h-8 w-8 text-candy-deep" />
        </RepeatButton>
      </div>
    </div>
  )
}
