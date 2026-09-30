import { useEffect, useRef, type ReactNode } from 'react'
import { Activity, Layers, Sparkles, Target, Timer, TrendingUp } from 'lucide-react'
import { cn, formatMs, formatNumber } from '@/lib/utils'
import { useGameStore } from '@/store/useGameStore'
import { summarizeHistory } from './decisionSource'

function StatCard({
  icon,
  label,
  value,
  suffix,
  accent = 'text-[#12708F]',
  highlight = false,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  suffix?: string
  accent?: string
  highlight?: boolean
  hint?: string
}) {
  const prevRef = useRef(value)
  const jump = highlight && prevRef.current !== value

  useEffect(() => {
    prevRef.current = value
  }, [value])

  return (
    <div className="panel flex items-center gap-3 px-3 py-2.5">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-cloud-50 shadow-clay-sm', accent)}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="label-key">{label}</div>
        <div className="flex items-baseline gap-1">
          <span key={jump ? value : 'steady'} className={cn('stat-value text-xl', jump && 'animate-pop')}>
            {value}
          </span>
          {suffix ? <span className="text-[12px] text-candy-muted">{suffix}</span> : null}
        </div>
        {hint ? <div className="font-fun text-[12px] text-candy-muted">{hint}</div> : null}
      </div>
    </div>
  )
}

/** 运行概况：消行 / 速度 / 模型决策率 / 决策耗时 */
export function StatsPanel() {
  const stats = useGameStore((state) => state.stats)
  const decisionStats = useGameStore((state) => state.decisionStats)
  const history = useGameStore((state) => state.history)

  const summary = summarizeHistory(history)
  const decided = summary.modelSteps + summary.fallback

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
      <StatCard
        icon={<Layers className="h-4 w-4" />}
        label="消行"
        value={formatNumber(stats.lines)}
        accent="text-[#6534B8]"
        highlight
      />
      <StatCard
        icon={<Sparkles className="h-4 w-4" />}
        label="方块数"
        value={formatNumber(stats.pieces)}
        accent="text-[#CC4453]"
      />
      <StatCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="速度 PPS"
        value={stats.pps.toFixed(2)}
        suffix="块/秒"
        accent="text-[#1F8B58]"
      />
      <StatCard
        icon={<Target className="h-4 w-4" />}
        label="模型决策率"
        value={decided === 0 ? '—' : (summary.participation * 100).toFixed(0)}
        suffix={decided === 0 ? undefined : '%'}
        accent="text-[#B23F79]"
        hint={
          summary.modelDiverge > 0
            ? `分歧 ${summary.modelDiverge} 步 · 均低 ${summary.avgGap.toFixed(1)} 分`
            : `兜底 ${summary.fallback} 步`
        }
      />
      <StatCard
        icon={<Activity className="h-4 w-4" />}
        label="平均决策耗时"
        value={formatMs(decisionStats.avgLatencyMs)}
        suffix={`${decisionStats.decisions} 次`}
        accent="text-[#2B5FC4]"
      />
      <StatCard
        icon={<Timer className="h-4 w-4" />}
        label="运行时长"
        value={`${stats.elapsedSec.toFixed(0)}`}
        suffix="秒"
        accent="text-[#B95A14]"
      />
    </div>
  )
}
