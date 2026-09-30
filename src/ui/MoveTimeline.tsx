import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, History } from 'lucide-react'
import { PIECE_SKINS } from '@/core/constants'
import { cn, formatClock, formatMs } from '@/lib/utils'
import { useGameStore, type DecisionRecord } from '@/store/useGameStore'
import { Card, CardHeader, CardTitle } from './components/card'
import { Badge } from './components/badge'
import { Dialog, DialogContent } from './components/dialog'
import { RawPayloadDrawer } from './RawPayloadDrawer'
import {
  SOURCE_COLOR,
  classifyDecision,
  heuristicGap,
  sourceMeta,
  summarizeHistory,
  type DecisionOutcome,
} from './decisionSource'

type TimelineFilter = 'all' | DecisionOutcome

const FILTERS: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'model-agree', label: '模型·一致' },
  { id: 'model-diverge', label: '模型·分歧' },
  { id: 'fallback', label: '兜底' },
  { id: 'heuristic-mode', label: '启发式模式' },
]

/** 一行 = 一步决策。整行可点，打开详情弹窗 */
const TimelineRow = memo(function TimelineRow({
  record,
  isNewest,
  onOpen,
}: {
  record: DecisionRecord
  isNewest: boolean
  onOpen: (record: DecisionRecord) => void
}) {
  const selected = record.candidates.find((item) => item.id === record.selectedId)
  const noul = selected?.noul ?? null
  const meta = sourceMeta(record.source, record.mode)
  const skin = PIECE_SKINS[record.piece]
  const range = selected?.columnRange
  const columnText = range ? (range[0] === range[1] ? `第 ${range[0]} 列` : `第 ${range[0]}~${range[1]} 列`) : '—'
  const noulText = noul === null ? '启发式' : noul.toFixed(3)
  const outcome = classifyDecision(record)
  const gap = outcome === 'model-diverge' ? heuristicGap(record) : 0

  return (
    <button
      type="button"
      onClick={() => onOpen(record)}
      aria-label={`第 ${record.index} 步 · ${record.piece} 方块 · ${meta.label} · noul ${noulText} · ${columnText}${
        gap > 0.01 ? ` · 比启发式最优低 ${gap.toFixed(1)} 分` : ''
      } · 耗时 ${formatMs(record.totalLatencyMs)} · 点击查看详情`}
      className={cn(
        'group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3',
        'overflow-hidden rounded-[14px] border border-candy-line bg-cloud-50 py-2 pl-3.5 pr-3 text-left transition',
        'hover:border-candy-mint/60 hover:bg-candy-mint/12',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candy-sky/50',
        isNewest && 'border-candy-sky/50 ring-1 ring-candy-sky/25 animate-float-in',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: SOURCE_COLOR[meta.tone] }} />

      {/* 方块 + 序号 */}
      <span className="flex flex-col items-center gap-0.5">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[9px] font-fun text-[13px] font-bold"
          style={{ background: `${skin.base}26`, color: skin.deep, border: `1px solid ${skin.base}66` }}
        >
          {record.piece}
        </span>
        <span className="font-fun text-[12px] text-candy-muted">#{record.index}</span>
      </span>

      {/* 来源 + 落点 */}
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={meta.tone} className="px-1.5 py-0.5 text-[12px]">
            {meta.label}
          </Badge>
          {record.linesCleared > 0 ? (
            <span className="rounded-full bg-candy-lemon/35 px-1.5 py-0.5 font-fun text-[12px] font-bold text-[#8A5D05]">
              消 {record.linesCleared} 行
            </span>
          ) : null}
          {gap > 0.01 ? (
            <span className="font-fun text-[12px] text-[#B95A14]" title="该落点比启发式最优低多少分">
              低 {gap.toFixed(1)} 分
            </span>
          ) : null}
          {record.failedCount > 0 ? (
            <span className="font-fun text-[12px] font-bold text-[#CC4453]">失败 {record.failedCount}</span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-[13px] text-candy-muted">
          {columnText}
          {selected ? ` · ${selected.rotationLabel}` : ''}
        </span>
      </span>

      {/* noul + 开销 */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'font-fun font-bold leading-none tabular-nums',
            noul === null ? 'text-[13px] text-candy-muted' : 'text-[17px] text-candy-ink',
          )}
        >
          {noulText}
        </span>
        <span className="font-fun text-[12px] tabular-nums text-candy-muted">
          {formatMs(record.totalLatencyMs)} · {record.tokenTotal}tok
        </span>
      </span>
    </button>
  )
})

export function MoveTimeline() {
  const history = useGameStore((state) => state.history)
  const [active, setActive] = useState<DecisionRecord | null>(null)
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [scrolled, setScrolled] = useState(false)
  const listRef = useRef<HTMLUListElement | null>(null)
  const newestId = history[0]?.id

  const summary = useMemo(() => summarizeHistory(history), [history])

  const avgNoul = useMemo(() => {
    const values = history
      .flatMap((record) => record.candidates.filter((item) => item.id === record.selectedId).map((item) => item.noul))
      .filter((value): value is number => value !== null)
    return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
  }, [history])

  const rows = useMemo(
    () => (filter === 'all' ? history : history.filter((record) => classifyDecision(record) === filter)),
    [history, filter],
  )

  const counts: Record<TimelineFilter, number> = {
    all: summary.total,
    'model-agree': summary.modelAgree,
    'model-diverge': summary.modelDiverge,
    fallback: summary.fallback,
    'heuristic-mode': summary.heuristicMode,
  }

  // 新记录插到顶部：贴着顶就跟着滚到最新，否则浮出「回到最新」按钮，避免看着看着被顶走
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (list.scrollTop < 8) list.scrollTo({ top: 0 })
    else setScrolled(true)
  }, [newestId])

  const handleScroll = () => setScrolled((listRef.current?.scrollTop ?? 0) > 8)

  const scrollToNewest = () => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setScrolled(false)
  }

  const hasModelData = summary.modelSteps + summary.fallback > 0

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="flex-col items-stretch gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            <History className="h-4 w-4 text-[#6534B8]" />
            决策时间轴
          </CardTitle>
          <span className="font-fun text-[12px] text-candy-muted">共 {history.length} 步 · 最新在上</span>
        </div>

        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-fun text-[12px] text-candy-muted">
          <span className="h-2.5 w-1 rounded-full" style={{ background: SOURCE_COLOR.cyan }} />
          Laya 判定
          <span className="ml-1 h-2.5 w-1 rounded-full" style={{ background: SOURCE_COLOR.violet }} />
          Mock 模拟
          <span className="ml-1 h-2.5 w-1 rounded-full" style={{ background: SOURCE_COLOR.amber }} />
          启发式兜底
        </span>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="按决策来源筛选">
          {FILTERS.filter((item) => item.id !== 'heuristic-mode' || counts['heuristic-mode'] > 0).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'chip transition',
                filter === item.id ? 'border-candy-sky/60 bg-candy-sky/20 text-[#12708F]' : 'hover:text-candy-ink',
              )}
            >
              {item.label} {counts[item.id]}
            </button>
          ))}
        </div>

        {hasModelData ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip" title="模型独立决策的步数占「模型决策 + 兜底」的比例">
              模型参与率 {(summary.participation * 100).toFixed(0)}%
            </span>
            <span className="chip" title="模型偏离启发式最优的步数，以及平均每步低多少分">
              分歧 {summary.modelDiverge} 步
              {summary.modelDiverge > 0 ? ` · 均低 ${summary.avgGap.toFixed(1)} 分` : ''}
            </span>
            {avgNoul !== null ? <span className="chip">选中 noul 均值 {avgNoul.toFixed(3)}</span> : null}
          </div>
        ) : null}
      </CardHeader>

      <div className="relative">
        <ul
          ref={listRef}
          onScroll={handleScroll}
          className="no-scrollbar flex max-h-[58vh] min-h-[140px] flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-4 lg:max-h-[min(48vh,520px)]"
        >
          {rows.length === 0 ? (
            <li className="rounded-[16px] border border-dashed border-candy-line bg-cloud-50 px-4 py-6 text-center text-[13px] leading-relaxed text-candy-muted">
              {history.length === 0
                ? '还没有决策记录。开始游戏后，每一步决策都会留痕：方块、落点、noul、耗时与来源都能追溯。'
                : '当前筛选下没有记录，换个来源看看。'}
            </li>
          ) : (
            rows.map((record) => (
              <li key={record.id}>
                <TimelineRow record={record} isNewest={record.id === newestId} onOpen={setActive} />
              </li>
            ))
          )}
        </ul>

        {scrolled && rows.length > 0 ? (
          <button
            type="button"
            onClick={scrollToNewest}
            className="clay absolute bottom-5 right-6 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-fun text-[12px] font-bold text-candy-ink"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            回到最新
          </button>
        ) : null}
      </div>

      <Dialog open={active !== null} onOpenChange={(next) => (next ? null : setActive(null))}>
        {active ? (
          <DialogContent
            title={`第 ${active.index} 步决策 · ${active.piece} 方块`}
            description={`${formatClock(active.createdAt)} · 共 ${active.candidates.length} 个候选 · 耗时 ${formatMs(
              active.totalLatencyMs,
            )}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={sourceMeta(active.source, active.mode).tone}>
                {sourceMeta(active.source, active.mode).label}
              </Badge>
              <Badge tone="slate">{active.tokenTotal} tokens</Badge>
              <Badge tone={active.failedCount > 0 ? 'rose' : 'mint'}>失败 {active.failedCount}</Badge>
              <RawPayloadDrawer
                title={`第 ${active.index} 步 · 原始数据`}
                request={active.candidates.find((item) => item.id === active.selectedId)?.request ?? {}}
                response={active.candidates.find((item) => item.id === active.selectedId)?.response ?? {}}
              />
            </div>
            <p className="mt-3 rounded-[12px] border border-candy-line bg-cloud-50 p-3 text-[13px] leading-relaxed text-candy-muted">
              {active.reason}
            </p>
            <div className="mt-3 grid gap-2">
              {active.candidates.map((candidate) => {
                const chosen = candidate.id === active.selectedId
                return (
                  <div
                    key={candidate.id}
                    className={cn(
                      'rounded-[12px] border p-2.5 text-[13px]',
                      chosen ? 'border-candy-mint/60 bg-candy-mint/15' : 'border-candy-line bg-cloud-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-candy-ink">
                        第 {candidate.columnRange[0]}
                        {candidate.columnRange[1] !== candidate.columnRange[0] ? `~${candidate.columnRange[1]}` : ''} 列 ·{' '}
                        {candidate.rotationLabel}
                        {chosen ? ' · 已选中' : ''}
                      </span>
                      <span className="shrink-0 font-fun text-candy-muted">
                        noul {candidate.noul === null ? '失败' : candidate.noul.toFixed(4)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line leading-relaxed text-candy-muted">{candidate.description}</p>
                  </div>
                )
              })}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Card>
  )
}
