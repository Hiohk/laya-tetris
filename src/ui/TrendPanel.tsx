import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PIECE_SKINS } from '@/core/constants'
import { useGameStore, type DecisionRecord } from '@/store/useGameStore'
import { cn } from '@/lib/utils'

interface TrendPoint {
  index: number
  latency: number
  noul: number | null
  query: number
}

const SOURCE_STYLE: Record<string, { bg: string; label: string }> = {
  laya: { bg: '#3EC7F0', label: 'Laya 判定' },
  mock: { bg: '#B47CF7', label: 'Mock 模拟' },
  'heuristic-fallback': { bg: '#5B8DEF', label: '启发式兜底' },
}

function ribbonColor(record: DecisionRecord, mode: string): string {
  if (record.source === 'heuristic-fallback' && mode === 'heuristic') return '#4FD98B'
  return SOURCE_STYLE[record.source]?.bg ?? '#64748B'
}

/** 决策时序：耗时、noul 与每步来源一览 */
export function TrendPanel() {
  const history = useGameStore((state) => state.history)
  const mode = useGameStore((state) => state.mode)

  const points = useMemo<TrendPoint[]>(
    () =>
      [...history]
        .reverse()
        .slice(-30)
        .map((record) => {
          const selected = record.candidates.find((item) => item.id === record.selectedId)
          return {
            index: record.index,
            latency: Math.round(record.totalLatencyMs),
            query: Math.round(record.stages?.queryMs ?? 0),
            noul: selected?.noul ?? null,
          }
        }),
    [history],
  )

  const ribbon = history.slice(0, 48).reverse()

  return (
    <div className="flex flex-col gap-3">
      <div className="min-h-[176px]">
        {points.length === 0 ? (
          <div className="flex h-[176px] items-center justify-center text-[13px] text-candy-muted">
            暂无数据，开始游戏后这里会绘制每步决策的耗时与 noul 走势
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <ComposedChart data={points} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3EC7F0" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3EC7F0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="queryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4FD98B" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#4FD98B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="index"
                stroke="rgba(139,155,180,0.55)"
                tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="latency"
                stroke="rgba(139,155,180,0.55)"
                tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <YAxis yAxisId="noul" orientation="right" domain={[0, 1]} hide />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.96)',
                  border: '1px solid rgba(255,255,255,0.9)',
                  borderRadius: 16,
                  fontSize: 11,
                  fontFamily: 'Fredoka, Nunito, system-ui, sans-serif',
                  color: '#1E3A5F',
                }}
                labelFormatter={(label) => `第 ${label} 步`}
                formatter={(value: number, name: string) => {
                  if (name === 'noul') return [Number(value).toFixed(4), 'noul']
                  if (name === 'query') return [`${value} ms`, '模型询问']
                  return [`${value} ms`, '端到端']
                }}
              />
              <Area
                yAxisId="latency"
                type="monotone"
                dataKey="latency"
                name="latency"
                stroke="#3EC7F0"
                strokeWidth={2}
                fill="url(#latencyFill)"
              />
              <Area
                yAxisId="latency"
                type="monotone"
                dataKey="query"
                name="query"
                stroke="#4FD98B"
                strokeWidth={1.5}
                fill="url(#queryFill)"
              />
              <Line
                yAxisId="noul"
                type="monotone"
                dataKey="noul"
                name="noul"
                stroke="#B47CF7"
                strokeWidth={2}
                dot={{ r: 2, fill: '#B47CF7' }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] text-candy-muted">
          <span>每步来源</span>
          {Object.entries(SOURCE_STYLE).map(([key, style]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-[12px]" style={{ background: style.bg }} />
              {style.label}
            </span>
          ))}
        </div>
        <div className="flex h-6 gap-0.5 overflow-hidden rounded-[16px] border border-candy-line bg-cloud-50 p-0.5">
          {ribbon.length === 0 ? (
            <span className="flex flex-1 items-center justify-center text-[12px] text-candy-muted">暂无记录</span>
          ) : (
            ribbon.map((record) => (
              <span
                key={record.id}
                title={`第 ${record.index} 步 · ${record.piece} · ${
                  record.candidates.find((item) => item.id === record.selectedId)?.noul?.toFixed(3) ?? '启发式'
                }`}
                className={cn('h-full flex-1 rounded-[2px] transition-opacity hover:opacity-70')}
                style={{
                  background: ribbonColor(record, record.mode),
                  opacity:
                    record.candidates.find((item) => item.id === record.selectedId)?.metrics.lines_cleared
                      ? 1
                      : 0.45,
                }}
              />
            ))
          )}
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-candy-muted">
        青色面积是端到端耗时（含并行请求的最慢一路），靛蓝色是模型询问阶段耗时，紫色折线是当步选中落点的 noul。
        底部色条按时间顺序展示每一步的决策来源与方块配色，越亮代表该步消除了行。
      </p>
    </div>
  )
}
