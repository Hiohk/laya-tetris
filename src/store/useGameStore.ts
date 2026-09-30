import { create } from 'zustand'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from '@/ai/settings'
import type {
  DecisionProgress,
  DecisionResult,
  DecisionSource,
  DecisionStages,
  EvaluatedCandidate,
} from '@/ai/types'
import type { PieceType } from '@/core/constants'
import type { GameStatus } from '@/core/engine'

export type DriveMode = 'laya' | 'heuristic' | 'manual'

/**
 * 运行时阶段：前 4 个是决策阶段，后 4 个是落子执行阶段。
 * 阶段变化会推到界面上的「决策流程」链条里，让每一步决策都能被看见。
 */
export type RuntimePhase =
  | 'idle'
  | 'enumerate'
  | 'rank'
  | 'query'
  | 'select'
  | 'preview'
  | 'travel'
  | 'hover'
  | 'drop'
  | 'manual'

export interface DecisionRecord {
  id: string
  index: number
  piece: PieceType
  pieceId: number
  createdAt: number
  mode: DriveMode
  source: DecisionSource
  reason: string
  selectedId: string
  candidates: EvaluatedCandidate[]
  totalLatencyMs: number
  tokenTotal: number
  failedCount: number
  boardText: string
  linesCleared: number
  stages: DecisionStages
}

export interface RuntimeStats {
  score: number
  lines: number
  level: number
  combo: number
  pieces: number
  elapsedSec: number
  pps: number
  clearedRows: number
}

export interface DecisionStats {
  decisions: number
  requests: number
  okRequests: number
  failedRequests: number
  fallbacks: number
  avgLatencyMs: number
  lastLatencyMs: number
  tokenTotal: number
  avgNoul: number
}

export interface ConnectionState {
  state: 'unknown' | 'checking' | 'ok' | 'error'
  message: string
  latencyMs: number | null
}

interface GameStore {
  settings: AppSettings
  mode: DriveMode
  status: GameStatus
  thinking: boolean
  phase: RuntimePhase
  phaseDetail: string
  stats: RuntimeStats
  decisionStats: DecisionStats
  connection: ConnectionState
  hold: PieceType | null
  nextTypes: PieceType[]
  currentType: PieceType | null
  currentPieceId: number
  liveDecision: DecisionResult | null
  liveCandidates: EvaluatedCandidate[]
  history: DecisionRecord[]
  setSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void
  setMode: (mode: DriveMode) => void
  setStatus: (status: GameStatus) => void
  setThinking: (thinking: boolean) => void
  setPhase: (phase: RuntimePhase, detail?: string) => void
  setConnection: (connection: Partial<ConnectionState>) => void
  syncRuntime: (
    patch: Partial<RuntimeStats> & {
      status?: GameStatus
      hold?: PieceType | null
      nextTypes?: PieceType[]
      currentType?: PieceType | null
      currentPieceId?: number
    },
  ) => void
  pushProgress: (progress: DecisionProgress) => void
  pushDecision: (result: DecisionResult, mode: DriveMode) => void
  clearHistory: () => void
  resetSession: () => void
}

const EMPTY_RUNTIME: RuntimeStats = {
  score: 0,
  lines: 0,
  level: 1,
  combo: 1,
  pieces: 0,
  elapsedSec: 0,
  pps: 0,
  clearedRows: 0,
}

const EMPTY_DECISION_STATS: DecisionStats = {
  decisions: 0,
  requests: 0,
  okRequests: 0,
  failedRequests: 0,
  fallbacks: 0,
  avgLatencyMs: 0,
  lastLatencyMs: 0,
  tokenTotal: 0,
  avgNoul: 0,
}

const HISTORY_LIMIT = 120

function average(prev: number, next: number, count: number): number {
  if (count <= 0) return next
  return (prev * (count - 1) + next) / count
}

export const useGameStore = create<GameStore>()((set, get) => ({
  settings: loadSettings(),
  mode: 'laya',
  status: 'ready',
  thinking: false,
  phase: 'idle',
  phaseDetail: '',
  stats: { ...EMPTY_RUNTIME },
  decisionStats: { ...EMPTY_DECISION_STATS },
  connection: { state: 'unknown', message: '尚未检测模型连接', latencyMs: null },
  hold: null,
  nextTypes: [],
  currentType: null,
  currentPieceId: 0,
  liveDecision: null,
  liveCandidates: [],
  history: [],

  setSettings: (patch) => {
    const next = { ...get().settings, ...patch }
    saveSettings(next)
    set({ settings: next })
  },

  resetSettings: () => {
    saveSettings(DEFAULT_SETTINGS)
    set({ settings: { ...DEFAULT_SETTINGS } })
  },

  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),
  setThinking: (thinking) => set({ thinking }),
  setPhase: (phase, detail = '') =>
    set((state) => (state.phase === phase && state.phaseDetail === detail ? state : { phase, phaseDetail: detail })),
  setConnection: (patch) => set({ connection: { ...get().connection, ...patch } }),

  syncRuntime: (patch) => {
    set((state) => ({
      stats: {
        score: patch.score ?? state.stats.score,
        lines: patch.lines ?? state.stats.lines,
        level: patch.level ?? state.stats.level,
        combo: patch.combo ?? state.stats.combo,
        pieces: patch.pieces ?? state.stats.pieces,
        elapsedSec: patch.elapsedSec ?? state.stats.elapsedSec,
        pps: patch.pps ?? state.stats.pps,
        clearedRows: patch.clearedRows ?? state.stats.clearedRows,
      },
      status: patch.status ?? state.status,
      hold: patch.hold === undefined ? state.hold : patch.hold,
      nextTypes: patch.nextTypes ?? state.nextTypes,
      currentType: patch.currentType === undefined ? state.currentType : patch.currentType,
      currentPieceId: patch.currentPieceId ?? state.currentPieceId,
    }))
  },

  pushProgress: (progress) => {
    set((state) => ({
      liveCandidates: progress.candidates,
      currentPieceId: progress.pieceId,
      currentType: progress.piece,
      liveDecision: state.liveDecision?.decisionId === progress.decisionId ? state.liveDecision : null,
    }))
  },

  pushDecision: (result, mode) => {
    const previous = get().decisionStats
    const okCount = result.candidates.filter((item) => item.status === 'ok').length
    const noulValues = result.candidates.filter((item) => item.noul !== null).map((item) => item.noul as number)
    const avgNoul = noulValues.length > 0 ? noulValues.reduce((a, b) => a + b, 0) / noulValues.length : 0
    const selected = result.candidates.find((item) => item.id === result.selectedId) ?? null
    const decisionCount = previous.decisions + 1

    const record: DecisionRecord = {
      id: result.decisionId,
      index: decisionCount,
      piece: result.piece,
      pieceId: result.pieceId,
      createdAt: result.createdAt,
      mode,
      source: result.source,
      reason: result.reason,
      selectedId: result.selectedId,
      candidates: result.candidates,
      totalLatencyMs: result.totalLatencyMs,
      tokenTotal: result.tokenTotal,
      failedCount: result.failedCount,
      boardText: result.boardText,
      linesCleared: selected?.metrics.lines_cleared ?? 0,
      stages: result.stages,
    }

    set((state) => ({
      liveDecision: result,
      liveCandidates: result.candidates,
      currentPieceId: result.pieceId,
      currentType: result.piece,
      history: [record, ...state.history].slice(0, HISTORY_LIMIT),
      decisionStats: {
        decisions: decisionCount,
        requests: previous.requests + result.requestCount,
        okRequests: previous.okRequests + okCount,
        failedRequests: previous.failedRequests + result.failedCount,
        fallbacks: previous.fallbacks + (result.source === 'heuristic-fallback' ? 1 : 0),
        avgLatencyMs: average(previous.avgLatencyMs, result.totalLatencyMs, decisionCount),
        lastLatencyMs: result.totalLatencyMs,
        tokenTotal: previous.tokenTotal + result.tokenTotal,
        avgNoul,
      },
    }))
  },

  clearHistory: () => set({ history: [], liveDecision: null, liveCandidates: [] }),

  resetSession: () =>
    set({
      stats: { ...EMPTY_RUNTIME },
      decisionStats: { ...EMPTY_DECISION_STATS },
      history: [],
      liveDecision: null,
      liveCandidates: [],
      thinking: false,
      phase: 'idle',
      phaseDetail: '',
    }),
}))
