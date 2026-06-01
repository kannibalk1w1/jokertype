import type { EffectIntensity } from './settings'
import type { TypingEffectEvent } from './changeClassifier'

export class PitchStreak {
  private level = 0

  nextPitch(): number {
    this.level += 1
    return Math.min(1.3, Math.max(0.95, 1 + this.level * 0.01))
  }

  reset(): void {
    this.level = 0
  }
}

export interface AudioEngineOptions {
  soundEnabled: boolean
  effectIntensity: EffectIntensity
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private streak = new PitchStreak()
  private resetTimer: ReturnType<typeof setTimeout> | null = null

  play(event: TypingEffectEvent, options: AudioEngineOptions): void {
    if (!options.soundEnabled) return

    try {
      const ctx = this.ensureContext()
      if (!ctx) return

      const pitch = this.nextPitch()
      const now = ctx.currentTime
      const gain = ctx.createGain()
      const osc = ctx.createOscillator()

      osc.type = event.type === 'delete' ? 'square' : 'triangle'
      osc.frequency.value = baseFrequencyFor(event.type) * pitch
      gain.gain.setValueAtTime(gainFor(options.effectIntensity), now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationFor(event.type))
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + durationFor(event.type))
    } catch {
      this.streak.reset()
    }
  }

  dispose(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer)
    this.resetTimer = null
    this.streak.reset()
    const ctx = this.ctx
    this.ctx = null
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {})
    }
  }

  private ensureContext(): AudioContext | null {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
    if (!AudioContextCtor) return null
    if (!this.ctx) this.ctx = new AudioContextCtor()
    return this.ctx
  }

  private nextPitch(): number {
    const pitch = this.streak.nextPitch()
    if (this.resetTimer) clearTimeout(this.resetTimer)
    this.resetTimer = setTimeout(() => this.streak.reset(), 300)
    return pitch
  }
}

function baseFrequencyFor(type: TypingEffectEvent['type']): number {
  if (type === 'enter') return 740
  if (type === 'delete') return 260
  if (type === 'chunk') return 560
  return 440
}

function durationFor(type: TypingEffectEvent['type']): number {
  if (type === 'enter' || type === 'chunk') return 0.08
  return 0.045
}

function gainFor(intensity: EffectIntensity): number {
  if (intensity === 'low') return 0.018
  if (intensity === 'high') return 0.055
  return 0.035
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
