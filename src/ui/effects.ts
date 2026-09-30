import { COLS } from '@/core/constants'
import { roundRect } from './render'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  maxLife: number
  rot: number
  vrot: number
  round: boolean
}

interface Popup {
  x: number
  y: number
  text: string
  color: string
  life: number
  maxLife: number
}

const GRAVITY = 30
const SHAKE_MS = 340
const FLASH_MS = 460

/**
 * 消行反馈：粒子爆炸 + 白光横扫 + 轻微震动 + 浮动文字。
 * 粒子坐标以「格」为单位，绘制时再乘以格子尺寸，因此窗口缩放不会错位。
 */
export class Effects {
  private particles: Particle[] = []
  private popups: Popup[] = []
  private flashRows: number[] = []
  private flashAt = 0
  private shakeAt = 0
  private shakeStrength = 0

  clear(): void {
    this.particles = []
    this.popups = []
    this.flashRows = []
    this.shakeAt = 0
    this.flashAt = 0
  }

  /** 每一行被消掉时，从该行的方块位置炸出一簇糖果粒子 */
  burstRow(row: number, colors: string[], pieceColor: string): void {
    for (let c = 0; c < COLS; c += 1) {
      for (let i = 0; i < 3; i += 1) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9
        const speed = 5 + Math.random() * 9
        const usePieceColor = Math.random() < 0.42
        this.particles.push({
          x: c + 0.5 + (Math.random() - 0.5) * 0.8,
          y: row + 0.5 + (Math.random() - 0.5) * 0.6,
          vx: Math.cos(angle) * speed * (0.6 + Math.random() * 0.8),
          vy: Math.sin(angle) * speed - Math.random() * 3,
          size: 0.14 + Math.random() * 0.2,
          color: usePieceColor ? pieceColor : colors[(Math.random() * colors.length) | 0],
          life: 560 + Math.random() * 420,
          maxLife: 980,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 12,
          round: Math.random() < 0.35,
        })
      }
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420)
  }

  popup(text: string, x: number, y: number, color: string): void {
    this.popups.push({ x, y, text, color, life: 1000, maxLife: 1000 })
  }

  flash(rows: number[]): void {
    this.flashRows = rows
    this.flashAt = performance.now()
  }

  shake(strength = 1): void {
    this.shakeAt = performance.now()
    this.shakeStrength = strength
  }

  shakeOffset(now: number): { x: number; y: number } {
    const elapsed = now - this.shakeAt
    if (this.shakeAt === 0 || elapsed > SHAKE_MS) return { x: 0, y: 0 }
    const decay = (1 - elapsed / SHAKE_MS) * this.shakeStrength
    const amp = 5 * decay
    return { x: (Math.random() - 0.5) * amp, y: (Math.random() - 0.5) * amp }
  }

  update(dt: number): void {
    const seconds = dt / 1000
    this.particles = this.particles.filter((p) => {
      p.life -= dt
      p.vy += GRAVITY * seconds
      p.x += p.vx * seconds
      p.y += p.vy * seconds
      p.rot += p.vrot * seconds
      p.vx *= 1 - 0.9 * seconds
      return p.life > 0 && p.y < 24
    })
    this.popups = this.popups.filter((p) => {
      p.life -= dt
      p.y -= 1.1 * seconds
      return p.life > 0
    })
  }

  draw(ctx: CanvasRenderingContext2D, cell: number): void {
    const now = performance.now()

    const flashElapsed = now - this.flashAt
    if (this.flashAt > 0 && flashElapsed < FLASH_MS) {
      const progress = 1 - flashElapsed / FLASH_MS
      const gradient = ctx.createLinearGradient(0, 0, COLS * cell, 0)
      gradient.addColorStop(0, 'rgba(255,255,255,0)')
      gradient.addColorStop(0.5, `rgba(255,255,255,${0.9 * progress})`)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      this.flashRows.forEach((row) => {
        ctx.save()
        roundRect(ctx, 0, row * cell + cell * 0.06, COLS * cell, cell * 0.88, cell * 0.3)
        ctx.fill()
        ctx.restore()
      })
    }

    this.particles.forEach((p) => {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife + 0.25))
      const size = p.size * cell
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x * cell, p.y * cell)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.shadowColor = 'rgba(120,160,200,0.35)'
      ctx.shadowBlur = size * 0.4
      if (p.round) {
        ctx.beginPath()
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.3)
        ctx.fill()
      }
      ctx.restore()
    })

    this.popups.forEach((p) => {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = `700 ${Math.round(cell * 1.05)}px Fredoka, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.lineWidth = cell * 0.22
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeText(p.text, p.x * cell, p.y * cell)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x * cell, p.y * cell)
      ctx.restore()
    })
  }
}
