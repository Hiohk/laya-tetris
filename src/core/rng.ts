import { PIECE_TYPES, type PieceType } from './constants'

/** mulberry32：小而稳定的可复现随机数发生器 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** 标准 7-bag：每 7 个方块内每种各出现一次 */
export function createBag(random: () => number): () => PieceType {
  let pool: PieceType[] = []
  return () => {
    if (pool.length === 0) {
      pool = [...PIECE_TYPES]
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
    }
    return pool.pop() as PieceType
  }
}
