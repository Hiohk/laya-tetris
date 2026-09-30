import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGameStore } from '@/store/useGameStore'
import { cn } from '@/lib/utils'
import { summarizeHistory } from './decisionSource'

interface Bucket {
  bucket: string
  selected: number
  rejected: number
}

/**
 * 校准分布：把历史所有候选的 noul 概率分桶，区分「被选中」与「未被选中」，
 * 用来观察模型是否真的把高概率给了它最终采纳的落点（区分度）。
 *
 * 另附「模型参与度」三分类，回答「这一步到底是模型决定的还是降级了」：
 * 采纳启发式最优 / 模型分歧 / 启发式兜底。启发式模式的步数单独归类，不混进来。
 */
export function CalibrationPanel() {
  const history = useGameStore((state) => state.history)

  const summary = useMemo(() => summarizeHistory(history), [history])

  const { buckets, selectedAvg, rejectedAvg, coverage } = useMemo(() => {
    const rows: Bucket[] = Array.from({ length: 10 }, (_, index) => ({
      bucket: `${index * 10}~${(index + 1) * 10}`,
      selected: 0,
      rejected: 0,
    }))
    const selectedValues: number[] = []
    const rejectedValues: number[] = []

    history.forEach((record) => {
      record.candidates.forEach((candidate) => {
        const noul = candidate.noul
        if (noul === null || noul === undefined) return
        const index = Math.min(9, Math.max(0, Math.floor(noul * 10)))
        if (candidate.id === record.selectedId) {
          rows[index].selected += 1
          selectedValues.push(noul)
        } else {
          rows[index].rejected += 1
          rejectedValues.push(noul)
        }
      })
    })

    const avg = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length)

    return {
      buckets: rows,
      selectedAvg: avg(selectedValues),
      rejectedAvg: avg(rejectedValues),
      coverage: selectedValues.length + rejectedValues.length,
    }
  }, [history])

  const gap = selectedAvg - rejectedAvg
  const adoptRate = summary.modelSteps === 0 ? null : (summary.modelAgree / summary.modelSteps) * 100

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="选中均值" value={selectedAvg.toFixed(3)} accent="text-[#1F8B58]" />
        <StatCard label="未选中均值" value={rejectedAvg.toFixed(3)} accent="text-[#6534B8]" />
        <StatCard
          label="区分度"
          value={`${gap >= 0 ? '+' : ''}${gap.toFixed(3)}`}
          accent={gap > 0.05 ? 'text-[#1F8B58]' : gap < 0 ? 'text-[#CC4453]' : 'text-[#12708F]'}
          hint="选中均值 − 未选中均值"
        />
        <StatCard label="采样候选" value={`${coverage}`} hint={`共 ${history.length} 步`} />
        <StatCard
          label="模型采纳最优"
          value={adoptRate === null ? '—' : `${adoptRate.toFixed(0)}%`}
          accent="text-[#1F8B58]"
          hint={`模型 ${summary.modelSteps} 步 · 兜底 ${summary.fallback} 步`}
        />
        <StatCard
          label="平均分歧代价"
          value={summary.modelDiverge === 0 ? '—' : `${summary.avgGap.toFixed(1)} 分`}
          accent={summary.modelDiverge === 0 ? undefined : 'text-[#B95A14]'}
          hint={`分歧 ${summary.modelDiverge} 步${summary.heuristicMode > 0 ? ` · 启发式模式 ${summary.heuristicMode} 步` : ''}`}
        />
      </div>

      <div className="min-h-[168px]">
        {coverage === 0 ? (
          <div className="flex h-[168px] items-center justify-center text-center text-[13px] leading-relaxed text-candy-muted">
            {history.length === 0
              ? '还没有决策数据。跑几步之后，这里会统计模型给每个候选打出的概率分布。'
              : '本次会话使用的是启发式模式或模型未返回概率，暂无 noul 采样。'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="bucket"
                stroke="rgba(139,155,180,0.55)"
                tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(139,155,180,0.55)"
                tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'rgba(62,199,240,0.08)' }}
                contentStyle={{
                  background: 'rgba(255,255,255,0.96)',
                  border: '1px solid rgba(255,255,255,0.9)',
                  borderRadius: 16,
                  fontSize: 11,
                  fontFamily: 'Fredoka, Nunito, system-ui, sans-serif',
                  color: '#1E3A5F',
                }}
                formatter={(value: number, name: string) => [`${value} 个`, name === 'selected' ? '被选中' : '未选中']}
                labelFormatter={(label) => `noul ${label}%`}
              />
              <Bar dataKey="selected" stackId="a" fill="#3EC7F0" radius={[0, 0, 0, 0]}>
                {buckets.map((row) => (
                  <Cell key={`s-${row.bucket}`} fill={row.selected > 0 ? '#3EC7F0' : 'transparent'} />
                ))}
              </Bar>
              <Bar dataKey="rejected" stackId="a" fill="rgba(180,124,247,0.45)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-[13px] leading-relaxed text-candy-muted">
        青色为「被模型选中」的候选，紫色为「未被选中」的候选。理想情况下青色会集中在右侧高概率区间，紫色偏向左侧；
        两者均值之差就是模型的区分度——差值越大，说明它给出的概率越能真正指导落点选择。
      </p>

      <p className="text-[13px] leading-relaxed text-candy-muted">
        「模型采纳最优」以<strong className="font-bold text-candy-ink">模型独立决策的步数</strong>为分母
        （不把兜底步算作一致，否则一致率会虚高），衡量模型是否选中了启发式最优落点；
        「平均分歧代价」是模型偏离时，每步平均比启发式最优低多少 Dellacherie 分。
        这两个数直接回答「这一步到底是模型决定的，还是被降级成启发式了」。
      </p>
    </div>
  )
}

function StatCard({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) {
  return (
    <div className="rounded-[12px] border border-candy-line bg-cloud-50 px-2 py-1.5">
      <div className="text-[12px] uppercase tracking-wider text-candy-muted">{label}</div>
      <div className={cn('font-fun text-sm font-bold text-candy-ink', accent)}>{value}</div>
      {hint ? <div className="mt-0.5 font-fun text-[12px] text-candy-muted">{hint}</div> : null}
    </div>
  )
}
