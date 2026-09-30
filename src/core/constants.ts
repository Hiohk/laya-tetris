export const COLS = 10
export const ROWS = 20

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** 棋盘格：0 表示空，其余为已锁定方块类型 */
export type BoardCell = 0 | PieceType
export type Board = BoardCell[][]

export interface PieceSkin {
  base: string
  deep: string
  glow: string
  text: string
}

/** 街机方块配色：饱和但不发光，靠硬描边与高光做出实体积木感 */
export const PIECE_SKINS: Record<PieceType, PieceSkin> = {
  I: { base: '#4FD98B', deep: '#0E6E62', glow: 'rgba(0,0,0,0.6)', text: '青' },
  O: { base: '#3EC7F0', deep: '#A86205', glow: 'rgba(0,0,0,0.6)', text: '黄' },
  T: { base: '#A78BFA', deep: '#5B27C4', glow: 'rgba(0,0,0,0.6)', text: '紫' },
  S: { base: '#4FD98B', deep: '#4D7C0F', glow: 'rgba(0,0,0,0.6)', text: '绿' },
  Z: { base: '#FF4D4D', deep: '#8F1D1D', glow: 'rgba(0,0,0,0.6)', text: '红' },
  J: { base: '#5B8DEF', deep: '#1A3FA8', glow: 'rgba(0,0,0,0.6)', text: '蓝' },
  L: { base: '#FF7A1A', deep: '#A83F08', glow: 'rgba(0,0,0,0.6)', text: '橙' },
}

/** 出生位置：x 为矩阵左上角所在列，y 为矩阵左上角所在行（可为负，表示出生在棋盘上方） */
export const SPAWN: Record<PieceType, { x: number; y: number }> = {
  I: { x: 3, y: -1 },
  O: { x: 4, y: 0 },
  T: { x: 3, y: 0 },
  S: { x: 3, y: 0 },
  Z: { x: 3, y: 0 },
  J: { x: 3, y: 0 },
  L: { x: 3, y: 0 },
}

export const LOCK_DELAY_MS = 420
export const MAX_LOCK_RESETS = 14

/** 每级重力间隔（毫秒），也可被 UI 的速度倍率缩放 */
export function gravityIntervalMs(level: number): number {
  const table = [0, 800, 720, 630, 550, 470, 380, 300, 220, 160, 120, 90, 70, 60, 50]
  if (level < table.length) return table[level]
  return 40
}

export const ROTATION_NAMES: Record<PieceType, string[]> = {
  I: ['横放', '竖放', '横放', '竖放'],
  O: ['方形', '方形', '方形', '方形'],
  T: ['尖朝上', '尖朝右', '尖朝下', '尖朝左'],
  S: ['横放朝右', '竖放朝右', '横放朝右', '竖放朝右'],
  Z: ['横放朝左', '竖放朝左', '横放朝左', '竖放朝左'],
  J: ['横放朝左', '竖放朝左', '横放朝左', '竖放朝左'],
  L: ['横放朝右', '竖放朝右', '横放朝右', '竖放朝右'],
}

export function rotationName(type: PieceType, rotation: number): string {
  return ROTATION_NAMES[type][rotation % 4]
}

export const SCORE_TABLE = [0, 100, 300, 500, 800]
