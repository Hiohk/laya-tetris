import { useEffect, useRef, type ReactNode } from 'react'
import { Crown, Flame, Star } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { useGameStore } from '@/store/useGameStore'

interface StatProps {
  icon: ReactNode
  label: string
  value: string
  accent: string
  highlight?: boolean
}

/** 数值大幅跳动（消行加了很多分）时才弹一下，避免软降时数字一直抖 */
function Stat({ icon, label, value, accent, highlight }: StatProps) {
  const prevRef = useRef(value)
  const jump = highlight && prevRef.current !== value

  useEffect(() => {
    prevRef.current = value
  }, [value])

  return (
    <div
      className={cn(
        'panel flex flex-1 items-center gap-2.5 px-3 py-2',
        highlight && 'border-candy-lemon/70 bg-candy-lemon/20',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-clay-sm', accent)}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="label-key">{label}</div>
        <div
          key={jump ? value : 'steady'}
          className={cn('stat-value origin-left text-[20px] lg:text-[24px]', jump && 'animate-pop')}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

/** 顶部分数 / 等级 / 连击 */
export function HudRow() {
  const stats = useGameStore((state) => state.stats)
  const combo = stats.combo

  return (
    <div className="flex gap-2">
      <Stat
        icon={<Star className="h-4 w-4 fill-candy-deep text-candy-deep" />}
        label="分数"
        value={formatNumber(stats.score)}
        accent="bg-gradient-to-b from-candy-sky to-[#2FB4DE]"
      />
      <Stat
        icon={<Crown className="h-4 w-4 fill-candy-deep text-candy-deep" />}
        label="等级"
        value={String(stats.level)}
        accent="bg-gradient-to-b from-candy-grape to-[#9A5FEA]"
      />
      <Stat
        icon={
          <Flame className={cn('h-4 w-4', combo > 1 ? 'fill-candy-deep text-candy-deep' : 'text-candy-muted')} />
        }
        label="连击"
        value={combo > 1 ? `x${combo}` : '—'}
        accent={combo > 1 ? 'bg-gradient-to-b from-candy-lemon to-[#F2A81E]' : 'bg-cloud-50'}
        highlight={combo > 1}
      />
    </div>
  )
}
