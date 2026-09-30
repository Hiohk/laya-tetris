import { DELLACHERIE_WEIGHTS, type FeatureBreakdown } from '@/core/metrics'
import type { PlacementOption } from './types'

export interface FeatureRow {
  key: keyof FeatureBreakdown
  label: string
  value: number
  weight: number
  contribution: number
  hint: string
}

export const FEATURE_LABELS: Record<keyof FeatureBreakdown, { label: string; hint: string }> = {
  landingHeight: { label: '落点高度', hint: '方块落定后的高度，越低越安全' },
  erodedPieceCells: { label: '消行贡献', hint: '消除行数 × 本方块被消掉的格数，越高越好' },
  rowTransitions: { label: '行翻转', hint: '行内凹凸切换次数，反映平整度' },
  colTransitions: { label: '列翻转', hint: '列内堆叠断裂次数，越高越零碎' },
  holes: { label: '空洞', hint: '被方块盖住的空格，是最致命的缺陷' },
  wellSums: { label: '井深度和', hint: '井的累计惩罚，深度井可留给 I 方块' },
}

/** 按 Dellacherie 权重排序候选（分数越高越好） */
export function rankPlacements(options: PlacementOption[]): PlacementOption[] {
  return [...options].sort((a, b) => b.heuristicScore - a.heuristicScore)
}

/**
 * 先按启发式排序，取前 N 个作为要问 Laya 的候选。
 * 保证启发式最优者一定在候选内（排序后天然满足）。
 */
export function selectCandidates(options: PlacementOption[], count: number): PlacementOption[] {
  const n = Math.max(2, Math.min(count, options.length))
  return rankPlacements(options).slice(0, n)
}

export function featureRows(features: FeatureBreakdown): FeatureRow[] {
  return (Object.keys(FEATURE_LABELS) as Array<keyof FeatureBreakdown>).map((key) => ({
    key,
    label: FEATURE_LABELS[key].label,
    value: Number(features[key].toFixed(2)),
    weight: DELLACHERIE_WEIGHTS[key],
    contribution: Number((features[key] * DELLACHERIE_WEIGHTS[key]).toFixed(2)),
    hint: FEATURE_LABELS[key].hint,
  }))
}

export function describeFeatures(features: FeatureBreakdown): string {
  return featureRows(features)
    .map((row) => `${row.label} ${row.value}`)
    .join(' · ')
}
