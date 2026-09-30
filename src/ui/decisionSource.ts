import type { DecisionRecord } from '@/store/useGameStore'

export type SourceTone = 'cyan' | 'violet' | 'amber'

/** 时间轴左侧色条用的来源色；与 sourceMeta 的 tone 一一对应 */
export const SOURCE_COLOR: Record<SourceTone, string> = {
  cyan: '#3EC7F0',
  violet: '#B47CF7',
  amber: '#FFC93C',
}

export function sourceMeta(source: string, mode: string): { label: string; tone: SourceTone } {
  if (source === 'laya') return { label: 'Laya 判定', tone: 'cyan' }
  if (source === 'mock') return { label: 'Mock 模拟', tone: 'violet' }
  return { label: mode === 'heuristic' ? '启发式模式' : '启发式兜底', tone: 'amber' }
}

/**
 * 每一步决策的归属，用于回答「这一步到底是不是模型自己决定的」：
 *  - heuristic-mode：启发式模式下跑的，与模型水平无关，不计入参与度
 *  - model-agree：模型独立决策，且恰好选中启发式最优落点
 *  - model-diverge：模型独立决策，但没选启发式最优 —— 模型在主动偏离，是分数下滑的主因
 *  - fallback：noul 低于阈值或请求失败，按协议降级为启发式最优
 */
export type DecisionOutcome = 'model-agree' | 'model-diverge' | 'fallback' | 'heuristic-mode'

export function classifyDecision(record: DecisionRecord): DecisionOutcome {
  if (record.mode === 'heuristic') return 'heuristic-mode'
  if (record.source === 'heuristic-fallback') return 'fallback'
  return record.stages.adoptedHeuristicBest ? 'model-agree' : 'model-diverge'
}

/**
 * 分歧代价：模型选中的落点比同批候选里的启发式最优低多少 Dellacherie 分（≥ 0）。
 * 候选集本身就是启发式前 N 名，所以集内最高分即全局启发式最优，无需额外查表。
 */
export function heuristicGap(record: DecisionRecord): number {
  if (record.candidates.length === 0) return 0
  const selected = record.candidates.find((item) => item.id === record.selectedId)
  if (!selected) return 0
  const best = Math.max(...record.candidates.map((item) => item.heuristicScore))
  return Math.max(0, best - selected.heuristicScore)
}

export interface ParticipationSummary {
  total: number
  modelAgree: number
  modelDiverge: number
  fallback: number
  heuristicMode: number
  /** 模型真正独立决策的步数（未降级、且不是启发式模式） */
  modelSteps: number
  /** 模型参与率 0~1：modelSteps / (modelSteps + fallback) */
  participation: number
  /** 分歧步的平均代价（只统计 model-diverge，无分歧时为 0） */
  avgGap: number
}

/**
 * 汇总整段历史里模型的参与情况。
 * 注意口径：启发式模式的步数既不算模型参与、也不算兜底，避免污染真实水平。
 */
export function summarizeHistory(history: DecisionRecord[]): ParticipationSummary {
  let modelAgree = 0
  let modelDiverge = 0
  let fallback = 0
  let heuristicMode = 0
  let gapSum = 0

  history.forEach((record) => {
    const outcome = classifyDecision(record)
    if (outcome === 'model-agree') modelAgree += 1
    else if (outcome === 'model-diverge') {
      modelDiverge += 1
      gapSum += heuristicGap(record)
    } else if (outcome === 'fallback') fallback += 1
    else heuristicMode += 1
  })

  const modelSteps = modelAgree + modelDiverge
  const denom = modelSteps + fallback

  return {
    total: history.length,
    modelAgree,
    modelDiverge,
    fallback,
    heuristicMode,
    modelSteps,
    participation: denom === 0 ? 0 : modelSteps / denom,
    avgGap: modelDiverge === 0 ? 0 : gapSum / modelDiverge,
  }
}
