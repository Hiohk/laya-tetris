export interface AppSettings {
  /** 端点：默认走 Vite 代理的相对路径；也可填绝对地址直连（需服务端开启 CORS） */
  endpoint: string
  model: string
  /** 送给 Laya 的候选数量（协议建议 4~8） */
  candidateCount: number
  /** 并发上限，避免打爆本地单实例推理服务 */
  concurrency: number
  timeoutMs: number
  /** noul 低于该阈值时降级为启发式最优落点（关闭 heuristicFallback 后此阈值不再生效） */
  threshold: number
  /**
   * 是否允许启发式兜底。
   * true：最高 noul 低于阈值时降级为启发式最优落点（协议默认行为）。
   * false：完全由模型决策，直接采用 noul 最高者，只在全部请求失败时才降级。
   */
  heuristicFallback: boolean
  /** 不开模型也能完整演示：用 Mock 概率替代真实 noul */
  useMock: boolean
  /** 协议中 board 行序存在冲突，这里提供翻转开关（默认第一行为最顶行） */
  flipBoardRows: boolean
  instructions: string
  /** 决策完成后先高亮目标落点、暂不移动的停留时间 */
  previewMs: number
  /** AI 落子的动画步进间隔（毫秒），越大越能看清旋转与平移 */
  moveDelayMs: number
  /** 移到目标位后悬停多久再硬降，便于观察落点与幽灵块是否吻合 */
  hoverMs: number
  /** 落定后的观察窗口，避免下一条决策立刻盖掉消行闪光 */
  settleMs: number
  /** 重力速度倍率 */
  speedScale: number
  /** 音效开关（移动端底部按钮可切换） */
  soundOn: boolean
  autoStart: boolean
  /** 棋盘上叠加候选落点预览 */
  showCandidateOverlay: boolean
  /** 决策前是否冻结重力（避免思考期间方块自己掉落） */
  freezeWhileThinking: boolean
}

export const DEFAULT_INSTRUCTIONS =
  '这个落点是一个好的落点吗？好的落点应尽量消除行、不制造空洞、保持堆叠低且平整。'

export const DEFAULT_SETTINGS: AppSettings = {
  endpoint: import.meta.env.VITE_LAYA_ENDPOINT || '/v1/systemone',
  model: import.meta.env.VITE_LAYA_MODEL || 'laya-multilingual-F16',
  candidateCount: 6,
  concurrency: 6,
  /**
   * 实测：本地 Laya 服务是**串行推理**（单个请求约 0.32s，6 个并发排队后最后一个约 1.9s）。
   * 所以超时上限必须按「候选数 × 单次推理」估，不能按单个请求估；
   * 1500ms 会让第 5、6 个候选必然超时，进而全部候选失败被误判成「模型不通」。
   */
  timeoutMs: 6000,
  threshold: 0.5,
  heuristicFallback: true,
  useMock: false,
  flipBoardRows: false,
  instructions: DEFAULT_INSTRUCTIONS,
  previewMs: 340,
  moveDelayMs: 150,
  hoverMs: 300,
  settleMs: 280,
  speedScale: 2,
  soundOn: true,
  autoStart: false,
  showCandidateOverlay: true,
  freezeWhileThinking: true,
}

/**
 * 存储键带版本号：调整默认值后，旧配置不会覆盖新默认值。
 * v3 → v4：单次超时默认值从 1500ms 提到 6000ms（旧值会让真实模型全部超时），
 * 老用户的 localStorage 里存着 1500，不换键就永远修不好。
 */
const STORAGE_KEY = 'laya-tetris-autopilot/settings/v4'

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch (error) {
    console.error('[settings] 读取本地配置失败，已回退默认值', error)
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
