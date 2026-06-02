import type { EffectIntensity, SoundStyle } from './settings'
import type { TypingEffectEvent } from './changeClassifier'
import { ENTER_SOUND_BASE64, TYPE_SOUND_BASE64 } from './hyperTypeSounds'

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
  soundStyle: SoundStyle
  volume: number
  effectIntensity: EffectIntensity
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private streak = new PitchStreak()
  private resetTimer: ReturnType<typeof setTimeout> | null = null
  private typeBuffer: AudioBuffer | null = null
  private enterBuffer: AudioBuffer | null = null
  private loadingBuffers: Promise<void> | null = null

  play(event: TypingEffectEvent, options: AudioEngineOptions): boolean {
    if (!options.soundEnabled) return false
    if (options.soundStyle === 'muted') return false
    if (event.type === 'delete') return false

    try {
      const ctx = this.ensureContext()
      if (!ctx) return false
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})

      const pitch = this.nextPitch()
      if (options.soundStyle === 'procedural') {
        playSynthFallback(ctx, event.type, pitch, options.effectIntensity, options.volume)
        return true
      }

      const buffer = event.type === 'enter' ? this.enterBuffer : this.typeBuffer

      if (buffer) {
        playBuffer(ctx, buffer, pitch, sampleGainFor(options.effectIntensity, options.volume))
        return true
      }

      void this.loadSampleBuffers(ctx)
      playSynthFallback(ctx, event.type, pitch, options.effectIntensity, options.volume)
      return true
    } catch {
      this.streak.reset()
      return false
    }
  }

  dispose(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer)
    this.resetTimer = null
    this.streak.reset()
    this.typeBuffer = null
    this.enterBuffer = null
    this.loadingBuffers = null
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

  private loadSampleBuffers(ctx: AudioContext): Promise<void> {
    if (this.loadingBuffers) return this.loadingBuffers

    this.loadingBuffers = Promise.all([
      decodeBase64Audio(ctx, TYPE_SOUND_BASE64),
      decodeBase64Audio(ctx, ENTER_SOUND_BASE64)
    ]).then(([typeBuffer, enterBuffer]) => {
      this.typeBuffer = typeBuffer
      this.enterBuffer = enterBuffer
    }).catch(() => {
      this.loadingBuffers = null
    })

    return this.loadingBuffers
  }
}

function playBuffer(ctx: AudioContext, buffer: AudioBuffer, pitch: number, gainValue: number): void {
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()

  source.buffer = buffer
  source.playbackRate.setValueAtTime(pitch, ctx.currentTime)
  gain.gain.setValueAtTime(gainValue, ctx.currentTime)

  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

type OscillatorKind = OscillatorType

interface SoundVoice {
  frequency: number
  gain: number
  delay: number
  type: OscillatorKind
  dropTo?: number
}

interface SoundSpec {
  duration: number
  voices: SoundVoice[]
}

function playSynthFallback(ctx: AudioContext, type: TypingEffectEvent['type'], pitch: number, intensity: EffectIntensity, volume: number): void {
  const now = ctx.currentTime
  const spec = soundSpecFor(type, intensity, volume)

  for (const voice of spec.voices) {
    const gain = ctx.createGain()
    const osc = ctx.createOscillator()
    const start = now + voice.delay
    const end = start + spec.duration

    osc.type = voice.type
    osc.frequency.setValueAtTime(voice.frequency * pitch, start)
    if (voice.dropTo) {
      osc.frequency.exponentialRampToValueAtTime(voice.dropTo * pitch, end)
    }

    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(voice.gain, start + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.001, end)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(end + 0.01)
  }
}

async function decodeBase64Audio(ctx: AudioContext, base64: string): Promise<AudioBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return ctx.decodeAudioData(bytes.buffer.slice(0))
}

function soundSpecFor(type: TypingEffectEvent['type'], intensity: EffectIntensity, volume: number): SoundSpec {
  const gain = gainFor(intensity, volume)
  if (type === 'enter') {
    return {
      duration: 0.11,
      voices: [
        { frequency: 392, gain: gain * 1.4, delay: 0, type: 'square', dropTo: 330 },
        { frequency: 784, gain: gain * 0.9, delay: 0.018, type: 'triangle' },
        { frequency: 1175, gain: gain * 0.55, delay: 0.035, type: 'triangle' }
      ]
    }
  }

  if (type === 'delete') {
    return {
      duration: 0.075,
      voices: [
        { frequency: 196, gain: gain * 1.15, delay: 0, type: 'sawtooth', dropTo: 110 },
        { frequency: 523, gain: gain * 0.55, delay: 0, type: 'square', dropTo: 330 }
      ]
    }
  }

  if (type === 'chunk') {
    return {
      duration: 0.095,
      voices: [
        { frequency: 330, gain: gain * 1.1, delay: 0, type: 'square' },
        { frequency: 660, gain: gain * 0.8, delay: 0.014, type: 'triangle' },
        { frequency: 990, gain: gain * 0.5, delay: 0.028, type: 'triangle' }
      ]
    }
  }

  return {
    duration: 0.055,
    voices: [
      { frequency: 523, gain, delay: 0, type: 'square', dropTo: 440 },
      { frequency: 1046, gain: gain * 0.42, delay: 0.012, type: 'triangle' }
    ]
  }
}

function gainFor(intensity: EffectIntensity, volume: number): number {
  const clampedVolume = Math.min(1, Math.max(0, volume))
  if (intensity === 'low') return 0.018 * clampedVolume
  if (intensity === 'high') return 0.075 * clampedVolume
  return 0.045 * clampedVolume
}

function sampleGainFor(intensity: EffectIntensity, volume: number): number {
  const clampedVolume = Math.min(1, Math.max(0, volume))
  if (intensity === 'low') return 0.25 * clampedVolume
  if (intensity === 'high') return 0.62 * clampedVolume
  return 0.45 * clampedVolume
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
