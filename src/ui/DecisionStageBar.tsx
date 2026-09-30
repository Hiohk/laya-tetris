import { Check, Loader2, Route } from 'lucide-react'
import { useGameStore, type RuntimePhase } from '@/store/useGameStore'
import { cn, formatMs } from '@/lib/utils'
import { Card } from './components/card'
import { sourceMeta } from './decisionSource'

interface StageDef {
  id: string
  label: string
  caption: string
}

const STAGES: StageDef[] = [
  { id: 'enumerate', label: '枚举落点', caption: '全部合法落点' },
  { id: 'rank', label: '筛选候选', caption: 'Dellacherie 排序' },
  { id: 'query', label: '并行询问', caption: '每候选一次请求' },
  { id: 'select', label: '选优判定', caption: '取 noul 最高' },
  { id: 'drop', label: '执行落子', caption: '预览→移动→硬降' },
]

const PHASE_INDEX: Record<RuntimePhase, number> = {
  idle: -1,
  manual: -1,
  enumerate: 0,
  rank: 1,
  query: 2,
  select: 3,
  preview: 4,
  travel: 4,
  hover: 4,
  drop: 4,
}

/** 决策流程链：把「枚举 → 筛选 → 询问 → 选优 → 落子」逐步点亮，并给出每段真实数据 */
export function DecisionStageBar() {
  const phase = useGameStore((state) => state.phase)
  const phaseDetail = useGameStore((state) => state.phaseDetail)
  const decision = useGameStore((state) => state.liveDecision)
  const thinking = useGameStore((state) => state.thinking)
  const mode = useGameStore((state) => state.mode)

  const activeIndex = PHASE_INDEX[phase]
  const stages = decision?.stages
  const selected = decision?.candidates.find((item) => item.id === decision.selectedId)
  const meta = decision ? sourceMeta(decision.source, mode) : null

  const values: string[] = [
    stages ? `${stages.placements} 个` : '—',
    stages ? `${stages.candidateCount} 个` : '—',
    stages ? formatMs(stages.queryMs) : '—',
    selected?.noul !== null && selected?.noul !== undefined ? selected.noul.toFixed(3) : meta ? '启发式' : '—',
    decision ? `${selected?.columnRange[0] ?? '—'} 列` : '—',
  ]

  return (
    <Card className="px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.05em] text-candy-muted">
          <Route className="h-3.5 w-3.5 text-[#1F8B58]" />
          决策流程
        </span>
        <span className="flex items-center gap-1.5 font-fun text-[12px] text-candy-muted">
          {thinking ? <Loader2 className="h-3 w-3 animate-spin text-[#1F8B58]" /> : null}
          {phase === 'idle' ? '待机' : phase === 'manual' ? '人工模式' : phaseDetail || '进行中'}
        </span>
      </div>

      <div className="flex items-start overflow-x-auto no-scrollbar">
        {STAGES.map((stage, index) => {
          const state = activeIndex === -1 ? 'pending' : index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
          return (
            <div key={stage.id} className="flex min-w-[68px] flex-1 shrink-0 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={cn('h-px flex-1', index === 0 ? 'bg-transparent' : 'connector-line')} />
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold transition-all duration-300',
                    state === 'done' && 'border-candy-mint/60 bg-candy-mint/15 text-[#1F8B58]',
                    state === 'active' &&
                      'animate-pulse-ring border-candy-mint bg-gradient-to-br from-candy-mint to-candy-grape text-candy-deep shadow-lite',
                    state === 'pending' && 'border-candy-line bg-cloud-50 text-candy-muted',
                  )}
                >
                  {state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className={cn('h-px flex-1', index === STAGES.length - 1 ? 'bg-transparent' : 'connector-line')} />
              </div>
              <span
                className={cn(
                  'mt-1.5 text-center text-[12px] font-semibold leading-tight',
                  state === 'pending' ? 'text-candy-muted' : 'text-candy-ink',
                )}
              >
                {stage.label}
              </span>
              <span className="mt-0.5 text-center font-fun text-[12px] text-[#1F8B58]/80">{values[index]}</span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 border-t border-candy-line pt-2 text-[13px] leading-relaxed text-candy-muted">
        {decision ? (
          <>
            <span className="font-semibold text-candy-ink">{meta?.label}</span>
            {' · '}
            {decision.reason}
            {stages && selected?.noul !== null && selected?.noul !== undefined && stages.heuristicBestNoul !== null ? (
              <span className="mt-1 block font-fun text-[12px] text-candy-muted">
                模型选中 noul {selected.noul.toFixed(3)} · 启发式最优 noul {stages.heuristicBestNoul.toFixed(3)} ·{' '}
                {stages.adoptedHeuristicBest ? '两者一致' : '存在分歧'}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-candy-muted">
            点击「开始」后，这里会一步一步点亮：枚举全部合法落点 → 启发式筛选候选 → 并行询问模型 → 比较 noul 选优 →
            预览落点并执行落子。
          </span>
        )}
      </p>
    </Card>
  )
}
