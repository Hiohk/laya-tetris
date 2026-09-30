import { useMemo } from 'react'
import { BrainCircuit, Gauge, Loader2, ShieldAlert, Sparkles } from 'lucide-react'
import { useGameStore } from '@/store/useGameStore'
import { formatMs } from '@/lib/utils'
import type { EvaluatedCandidate } from '@/ai/types'
import type { PieceType } from '@/core/constants'
import { CandidateCard } from './CandidateCard'
import { Badge } from './components/badge'
import { Card, CardHeader, CardTitle } from './components/card'
import { sourceMeta } from './decisionSource'

function sortCandidates(candidates: EvaluatedCandidate[], selectedId: string): EvaluatedCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.id === selectedId) return -1
    if (b.id === selectedId) return 1
    const aScore = a.noul ?? -1
    const bScore = b.noul ?? -1
    if (bScore !== aScore) return bScore - aScore
    return b.heuristicScore - a.heuristicScore
  })
}

export function DecisionPanel() {
  const decision = useGameStore((state) => state.liveDecision)
  const candidates = useGameStore((state) => state.liveCandidates)
  const thinking = useGameStore((state) => state.thinking)
  const mode = useGameStore((state) => state.mode)
  const currentType = useGameStore((state) => state.currentType) as PieceType | null

  const selectedId = decision?.selectedId ?? ''
  const ordered = useMemo(() => sortCandidates(candidates, selectedId), [candidates, selectedId])
  const validIds = useMemo(
    () =>
      candidates
        .filter((item) => item.noul !== null)
        .sort((a, b) => (b.noul ?? 0) - (a.noul ?? 0))
        .map((item) => item.id),
    [candidates],
  )

  const meta = decision ? sourceMeta(decision.source, mode) : null
  const pieceLabel = decision?.piece ?? currentType ?? '—'

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader>
        <CardTitle>
          <BrainCircuit className="h-3.5 w-3.5 text-[#1F8B58]" />
          Laya 决策看板
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : null}
          {thinking ? (
            <Badge tone="cyan">
              <Loader2 className="h-3 w-3 animate-spin" /> 推理中
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <div className="px-4">
        <div className="grid grid-cols-4 gap-2 rounded-[16px] border border-candy-line bg-cloud-50 p-2.5">
          <HeaderStat label="当前方块" value={pieceLabel} accent="text-candy-ink" />
          <HeaderStat label="候选数" value={candidates.length > 0 ? String(candidates.length) : '—'} accent="text-[#1F8B58]" />
          <HeaderStat label="本轮耗时" value={decision ? formatMs(decision.totalLatencyMs) : '—'} accent="text-[#6534B8]" />
          <HeaderStat
            label="Token"
            value={decision ? String(decision.tokenTotal) : '—'}
            accent="text-[#1F8B58]"
            hint={decision ? `失败 ${decision.failedCount}` : undefined}
          />
        </div>
        {decision ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-[12px] border border-candy-line bg-cloud-50 px-2.5 py-2 text-[13px] leading-relaxed text-candy-muted">
            <Gauge className="mt-0.5 h-3 w-3 shrink-0 text-[#1F8B58]" />
            {decision.reason}
          </p>
        ) : null}
      </div>

      <div className="no-scrollbar mt-3 flex min-h-0 max-h-[min(44vh,420px)] flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-4">
        {ordered.length === 0 ? (
          <EmptyState thinking={thinking} mode={mode} />
        ) : (
          ordered.map((candidate, index) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              rank={index + 1}
              selected={candidate.id === selectedId}
              decided={selectedId !== ''}
              validIds={validIds}
            />
          ))
        )}
      </div>
    </Card>
  )
}

function HeaderStat({
  label,
  value,
  accent,
  hint,
}: {
  label: string
  value: string
  accent: string
  hint?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-candy-muted">{label}</span>
      <span className={`font-fun text-sm font-bold ${accent}`}>{value}</span>
      {hint ? <span className="text-[12px] text-candy-muted">{hint}</span> : null}
    </div>
  )
}

function EmptyState({ thinking, mode }: { thinking: boolean; mode: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-candy-line bg-cloud-50 p-6 text-center">
      {thinking ? (
        <>
          <span className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute inset-0 animate-pulse-ring rounded-full border border-candy-mint/50" />
            <Loader2 className="h-5 w-5 animate-spin text-[#1F8B58]" />
          </span>
          <p className="text-xs font-semibold text-candy-ink">正在枚举落点并并行询问 Laya…</p>
          <p className="text-[13px] text-candy-muted">每个候选一次请求，返回一个就会点亮一张卡片</p>
        </>
      ) : (
        <>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-candy-line bg-cloud-50">
            {mode === 'manual' ? (
              <ShieldAlert className="h-5 w-5 text-[#12708F]" />
            ) : (
              <Sparkles className="h-5 w-5 text-[#1F8B58]" />
            )}
          </span>
          <p className="text-xs font-semibold text-candy-ink">
            {mode === 'manual' ? '当前是人工模式' : '等待第一步决策'}
          </p>
          <p className="max-w-[240px] text-[13px] leading-relaxed text-candy-muted">
            {mode === 'manual'
              ? '用键盘方向键操作，切换到 Laya 模型模式即可让模型接管。'
              : '点击「开始」，引擎生成第一个方块后就会自动发起决策请求。'}
          </p>
        </>
      )}
    </div>
  )
}
