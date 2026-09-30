import { BarChart3, Gauge, Radio, Sparkles, TrendingUp, Trophy } from 'lucide-react'
import { PIECE_SKINS } from '@/core/constants'
import { cn, formatMs } from '@/lib/utils'
import { useGameStore } from '@/store/useGameStore'
import type { EvaluatedCandidate } from '@/ai/types'
import { Card, CardHeader, CardTitle } from './components/card'
import { Badge } from './components/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs'
import { CalibrationPanel } from './CalibrationPanel'
import { TrendPanel } from './TrendPanel'
import { sourceMeta } from './decisionSource'

/** 选中候选的 noul 仪表盘：弧长 = 概率，黄色刻度 = 阈值 */
function NoulGauge({ value, threshold }: { value: number | null; threshold: number | null }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, value ?? 0))
  const angle = (threshold ?? 0) * 2 * Math.PI
  const tick = {
    x1: 60 + Math.cos(angle) * (radius - 8),
    y1: 60 + Math.sin(angle) * (radius - 8),
    x2: 60 + Math.cos(angle) * (radius + 8),
    y2: 60 + Math.sin(angle) * (radius + 8),
  }

  return (
    <div className="relative h-[152px] w-[152px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="noulGauge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3EC7F0" />
            <stop offset="55%" stopColor="#4FD98B" />
            <stop offset="100%" stopColor="#B47CF7" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(76,109,147,0.18)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#noulGauge)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 720ms cubic-bezier(0.22,1,0.36,1)' }}
        />
        {threshold !== null ? <line {...tick} stroke="#2B5FC4" strokeWidth="2.5" strokeLinecap="round" /> : null}
        <circle cx="60" cy="60" r={radius - 14} fill="none" stroke="rgba(76,109,147,0.12)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-fun text-[26px] font-bold leading-none text-candy-ink">
          {value === null ? '—' : value.toFixed(3)}
        </span>
        <span className="mt-1 text-[12px] uppercase tracking-[0.05em] text-candy-muted">noul 好落点概率</span>
        <span className="mt-1 font-fun text-[12px] text-[#12708F]">
          {threshold === null ? '兜底已关闭' : `阈值 ${threshold.toFixed(2)}`}
        </span>
      </div>
    </div>
  )
}

/** 所有候选的概率排名：条形 = noul，白色细线 = 启发式评分参考位置 */
function ProbabilityRanking({ candidates }: { candidates: EvaluatedCandidate[] }) {
  const sorted = [...candidates].sort((a, b) => (b.noul ?? -1) - (a.noul ?? -1))
  const scores = candidates.map((item) => item.heuristicScore)
  const min = scores.length > 0 ? Math.min(...scores) : 0
  const max = scores.length > 0 ? Math.max(...scores) : 1
  const span = max - min

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {sorted.map((candidate, index) => {
        const skin = PIECE_SKINS[candidate.type]
        const heuristicRatio = span <= 1e-6 ? 0.5 : (candidate.heuristicScore - min) / span
        const isSelected = candidate.status === 'ok' && candidate.noul !== null && index === 0
        return (
          <div key={candidate.id} className={cn('rounded-[12px] px-1.5 py-1', isSelected && 'bg-candy-mint/15')}>
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="font-fun text-candy-muted">#{index + 1}</span>
              <span
                className="rounded-[6px] px-1.5 font-fun font-bold"
                style={{ background: `${skin.base}26`, color: skin.deep }}
              >
                {candidate.type}
              </span>
              <span className="truncate text-candy-muted">
                第 {candidate.columnRange[0]}
                {candidate.columnRange[1] !== candidate.columnRange[0] ? `~${candidate.columnRange[1]}` : ''} 列 ·{' '}
                {candidate.rotationLabel}
              </span>
              {isSelected ? <Trophy className="h-3 w-3 text-[#12708F]" /> : null}
              <span className="ml-auto font-fun text-candy-ink">
                {candidate.status === 'error'
                  ? '失败'
                  : candidate.noul === null
                    ? candidate.status === 'pending'
                      ? '…'
                      : '—'
                    : candidate.noul.toFixed(4)}
              </span>
            </div>
            <div className="relative mt-1 h-[7px] w-full overflow-hidden rounded-full border border-candy-line bg-cloud-50">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${(candidate.noul ?? 0) * 100}%`,
                  background: `linear-gradient(90deg, ${skin.deep}, ${skin.base})`,
                  boxShadow: `0 0 12px -3px ${skin.glow}`,
                }}
              />
              <span
                className="absolute top-0 h-full w-px bg-candy-ink/45"
                style={{ left: `${heuristicRatio * 100}%` }}
                title={`启发式评分 ${candidate.heuristicScore.toFixed(2)} 在该批候选中的相对位置`}
              />
            </div>
          </div>
        )
      })}
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-candy-muted">还没有候选数据，开始游戏后这里会展示模型对每个落点的打分排名</p>
      ) : null}
    </div>
  )
}

function SummaryCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-[12px] border border-candy-line bg-cloud-50 px-2 py-1.5">
      <div className="text-[12px] uppercase tracking-wider text-candy-muted">{label}</div>
      <div className={cn('font-fun text-xs font-bold text-candy-ink', accent)}>{value}</div>
    </div>
  )
}

export function DecisionAnalytics() {
  const decision = useGameStore((state) => state.liveDecision)
  const mode = useGameStore((state) => state.mode)
  // 关闭兜底后阈值不再参与决策，表盘上的阈值刻度也随之去掉
  const threshold = useGameStore((state) =>
    state.settings.heuristicFallback ? state.settings.threshold : null,
  )

  const selected = decision?.candidates.find((item) => item.id === decision.selectedId) ?? null
  const okCount = decision?.candidates.filter((item) => item.status === 'ok').length ?? 0
  const meta = decision ? sourceMeta(decision.source, mode) : null

  return (
    <Card className="flex min-h-[300px] flex-col">
      <CardHeader>
        <CardTitle>
          <BarChart3 className="h-3.5 w-3.5 text-[#6534B8]" />
          模型决策分析
        </CardTitle>
        {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : null}
      </CardHeader>

      <Tabs defaultValue="distribution" className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <TabsList className="mb-3">
          <TabsTrigger value="distribution">
            <Gauge className="mr-1 h-3 w-3" />
            本步概率分布
          </TabsTrigger>
          <TabsTrigger value="calibration">
            <Radio className="mr-1 h-3 w-3" />
            校准分布
          </TabsTrigger>
          <TabsTrigger value="trend">
            <TrendingUp className="mr-1 h-3 w-3" />
            时序走势
          </TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="flex flex-col gap-3 focus:outline-none">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex justify-center sm:block">
              <NoulGauge value={selected?.noul ?? null} threshold={threshold} />
            </div>
            <ProbabilityRanking candidates={decision?.candidates ?? []} />
          </div>

          {decision ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryCell label="候选" value={`${decision.candidates.length} 个`} accent="text-[#1F8B58]" />
                <SummaryCell label="成功" value={`${okCount} 个`} accent="text-[#1F8B58]" />
                <SummaryCell
                  label="失败"
                  value={`${decision.failedCount} 个`}
                  accent={decision.failedCount > 0 ? 'text-[#CC4453]' : undefined}
                />
                <SummaryCell label="端到端" value={formatMs(decision.totalLatencyMs)} accent="text-[#6534B8]" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-candy-muted">
                <span className="chip">
                  <Sparkles className="h-3 w-3 text-[#1F8B58]" />
                  落点总数 {decision.stages.placements}
                </span>
                <span className="chip">token {decision.tokenTotal}</span>
                <span className="chip">
                  模型 vs 启发式：{decision.stages.adoptedHeuristicBest ? '一致' : '分歧'}
                </span>
                <span className="chip">
                  本次消除 {selected?.metrics.lines_cleared ?? 0} 行 · 空洞 {selected?.metrics.holes ?? 0}
                </span>
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-candy-muted">
              每完成一步决策，这里会画出模型对全部候选的概率分布：环形表盘是最终选中候选的 noul，横向条形是每个候选的
              noul 排名，白色细线标出启发式评分在同一批候选中的相对位置，方便直观看模型是否与启发式判断一致。
            </p>
          )}
        </TabsContent>

        <TabsContent value="calibration" className="focus:outline-none">
          <CalibrationPanel />
        </TabsContent>

        <TabsContent value="trend" className="focus:outline-none">
          <TrendPanel />
        </TabsContent>
      </Tabs>
    </Card>
  )
}
