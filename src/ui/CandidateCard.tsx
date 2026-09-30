import { useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { COLS, ROWS } from '@/core/constants'
import { cn, formatMs } from '@/lib/utils'
import type { EvaluatedCandidate } from '@/ai/types'
import { CANDY_COLORS, drawCandyBlock, drawPlayField } from './render'
import { RawPayloadDrawer } from './RawPayloadDrawer'
import { Badge } from './components/badge'

const PREVIEW_CELL = 7

function CandidatePreview({ candidate }: { candidate: EvaluatedCandidate }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = COLS * PREVIEW_CELL
    const height = ROWS * PREVIEW_CELL
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    drawPlayField(ctx, PREVIEW_CELL, width, height)

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const type = candidate.lockedBoard[r][c]
        if (type === 0) continue
        drawCandyBlock(ctx, c * PREVIEW_CELL, r * PREVIEW_CELL, PREVIEW_CELL, CANDY_COLORS[type], {
          alpha: 0.45,
          shadow: false,
        })
      }
    }
    candidate.cells.forEach(([r, c]) => {
      if (r < 0) return
      drawCandyBlock(ctx, c * PREVIEW_CELL, r * PREVIEW_CELL, PREVIEW_CELL, CANDY_COLORS[candidate.type])
    })
  }, [candidate])

  return (
    <canvas
      ref={ref}
      className="self-start rounded-[10px] border border-candy-line"
      style={{ width: COLS * PREVIEW_CELL }}
    />
  )
}

function MetricPill({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex flex-col items-center rounded-[12px] border border-candy-line bg-cloud-50 px-1.5 py-1">
      <span className="text-[12px] text-candy-muted">{label}</span>
      <span className={cn('font-fun text-xs font-bold text-candy-ink', tone)}>{value}</span>
    </div>
  )
}

export function CandidateCard({
  candidate,
  rank,
  selected,
  decided,
  validIds,
}: {
  candidate: EvaluatedCandidate
  rank: number
  selected: boolean
  /** 本轮决策是否已经出结果。推理进行中 selectedId 还是空串，
   *  没有它的话「noul 最高但被降级」会在每一步推理途中误报在当前领先的候选上 */
  decided: boolean
  validIds: string[]
}) {
  const probability = candidate.noul
  const barWidth = probability === null ? 0 : Math.round(probability * 100)
  const color = CANDY_COLORS[candidate.type]
  const isBestNoul = decided && probability !== null && validIds.length > 0 && validIds[0] === candidate.id && !selected
  const columnText =
    candidate.columnRange[0] === candidate.columnRange[1]
      ? `第 ${candidate.columnRange[0]} 列`
      : `第 ${candidate.columnRange[0]}~${candidate.columnRange[1]} 列`

  return (
    <div
      className={cn(
        'animate-float-in relative rounded-[20px] border bg-cloud-50 p-3 transition-all duration-200',
        selected
          ? 'border-candy-sky/70 bg-candy-sky/12 shadow-clay-sm'
          : 'border-candy-line hover:-translate-y-0.5 hover:bg-cloud-50',
      )}
    >
      <div className="flex gap-3">
        <CandidatePreview candidate={candidate} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full font-fun text-[12px] font-bold"
              style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
            >
              {rank}
            </span>
            <span className="font-fun text-xs font-bold text-candy-ink">{candidate.type}</span>
            <span className="text-[13px] text-candy-muted">
              {columnText} · {candidate.rotationLabel}
            </span>
            {selected ? (
              <Badge tone="cyan">
                <CheckCircle2 className="h-3 w-3" /> 已选中
              </Badge>
            ) : null}
            {isBestNoul ? <Badge tone="amber">noul 最高但被降级</Badge> : null}
            {candidate.status === 'error' ? (
              <Badge tone="rose">
                <AlertTriangle className="h-3 w-3" /> 请求失败
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5">
            <MetricPill label="消行" value={candidate.metrics.lines_cleared} tone="text-[#2AA46A]" />
            <MetricPill
              label="空洞"
              value={candidate.metrics.holes}
              tone={candidate.metrics.holes > 0 ? 'text-[#D9505F]' : 'text-[#2AA46A]'}
            />
            <MetricPill label="高度" value={candidate.metrics.max_height} />
            <MetricPill label="起伏" value={candidate.metrics.bumpiness} />
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[12px] text-candy-muted">
              <span className="flex items-center gap-1">
                noul 好落点概率
                {candidate.status === 'pending' ? <Loader2 className="h-3 w-3 animate-spin text-[#12708F]" /> : null}
              </span>
              <span className="font-fun font-bold text-candy-ink">
                {probability === null ? '等待中' : probability.toFixed(4)}
                {candidate.latencyMs !== null ? ` · ${formatMs(candidate.latencyMs)}` : ''}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-cloud-200 shadow-[inset_0_2px_4px_rgba(30,58,95,0.14)]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${barWidth}%`,
                  background: `linear-gradient(90deg, ${color}aa, ${color})`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <details className="group mt-2.5">
        <summary className="cursor-pointer select-none text-[12px] font-bold text-candy-muted transition hover:text-[#12708F]">
          查看送给 Laya 的中文落点陈述
        </summary>
        <p className="mt-2 whitespace-pre-line rounded-[14px] border border-candy-line bg-cloud-50 p-2.5 text-[13px] leading-relaxed text-candy-muted">
          {candidate.description}
        </p>
        {candidate.error ? (
          <p className="mt-1.5 rounded-[12px] border border-candy-berry/40 bg-candy-berry/10 p-2 font-fun text-[12px] text-[#D9505F]">
            {candidate.error}
          </p>
        ) : null}
      </details>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-fun text-[12px] text-candy-muted">
          启发式评分 {candidate.heuristicScore.toFixed(2)} · 落点高度 {candidate.features.landingHeight}
        </span>
        <RawPayloadDrawer
          title={`候选 ${candidate.type} · ${columnText}`}
          description="这是该候选实际发送与收到的原始 JSON，用于核对协议字段。"
          request={candidate.request ?? { note: '该候选尚未发出请求或请求体被省略' }}
          response={candidate.response ?? { note: candidate.error ?? '暂无响应' }}
        >
          <button
            type="button"
            className="rounded-full border border-candy-line bg-cloud-50 px-2.5 py-0.5 font-fun text-[12px] text-candy-muted transition hover:text-[#12708F]"
          >
            {'{ } JSON'}
          </button>
        </RawPayloadDrawer>
      </div>
    </div>
  )
}
