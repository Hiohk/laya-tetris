export type SoundName = 'move' | 'rotate' | 'drop' | 'clear' | 'combo' | 'hold' | 'over'

const NOTES: Record<SoundName, Array<{ freq: number; at: number; dur: number; type: OscillatorType; gain: number }>> = {
  move: [{ freq: 320, at: 0, dur: 0.05, type: 'triangle', gain: 0.05 }],
  rotate: [{ freq: 520, at: 0, dur: 0.06, type: 'triangle', gain: 0.06 }],
  drop: [
    { freq: 200, at: 0, dur: 0.09, type: 'sine', gain: 0.09 },
    { freq: 120, at: 0.05, dur: 0.12, type: 'sine', gain: 0.07 },
  ],
  clear: [
    { freq: 660, at: 0, dur: 0.1, type: 'sine', gain: 0.09 },
    { freq: 880, at: 0.08, dur: 0.12, type: 'sine', gain: 0.08 },
    { freq: 1180, at: 0.16, dur: 0.16, type: 'sine', gain: 0.07 },
  ],
  combo: [
    { freq: 780, at: 0, dur: 0.09, type: 'sine', gain: 0.09 },
    { freq: 1040, at: 0.07, dur: 0.1, type: 'sine', gain: 0.09 },
    { freq: 1320, at: 0.14, dur: 0.14, type: 'sine', gain: 0.08 },
    { freq: 1560, at: 0.22, dur: 0.18, type: 'sine', gain: 0.06 },
  ],
  hold: [{ freq: 460, at: 0, dur: 0.07, type: 'triangle', gain: 0.06 }],
  over: [
    { freq: 520, at: 0, dur: 0.16, type: 'sine', gain: 0.08 },
    { freq: 380, at: 0.14, dur: 0.18, type: 'sine', gain: 0.08 },
    { freq: 240, at: 0.3, dur: 0.3, type: 'sine', gain: 0.07 },
  ],
}

/** 极轻量的 WebAudio 音效，不依赖任何音频资源 */
export class Sfx {
  muted = false
  private ctx: AudioContext | null = null

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  resume(): void {
    this.ensure()
  }

  play(name: SoundName): void {
    if (this.muted) return
    const ctx = this.ensure()
    if (!ctx) return
    const now = ctx.currentTime
    NOTES[name].forEach((note) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = note.type
      osc.frequency.setValueAtTime(note.freq, now + note.at)
      gain.gain.setValueAtTime(0.0001, now + note.at)
      gain.gain.exponentialRampToValueAtTime(note.gain, now + note.at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + note.at)
      osc.stop(now + note.at + note.dur + 0.03)
    })
  }
}
