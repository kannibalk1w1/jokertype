import type { EffectIntensity, SoundStyle } from './settings'
import type { TypingEffectEvent } from './changeClassifier'
import { ENTER_SOUND_BASE64, TYPE_SOUND_BASE64 } from './hyperTypeSounds'

export class PitchStreak {
  private level = 0

  nextPitch(riseSteps = 35, maxPitch = 1.3): number {
    this.level += 1
    const safeSteps = Math.max(1, riseSteps)
    const safeMaxPitch = Math.min(1.6, Math.max(1, maxPitch))
    const increment = (safeMaxPitch - 1) / safeSteps
    return Math.min(safeMaxPitch, Math.max(0.95, 1 + this.level * increment))
  }

  reset(): void {
    this.level = 0
  }
}

export interface AudioEngineOptions {
  enabled: boolean
  soundEnabled: boolean
  soundStyle: SoundStyle
  volume: number
  customTypeSoundDataUrl: string | null
  customSpaceSoundDataUrl: string | null
  customEnterSoundDataUrl: string | null
  customDeleteSoundDataUrl: string | null
  customPasteSoundDataUrl: string | null
  pitchMax: number
  pitchRiseSteps: number
  pitchResetMs: number
  effectIntensity: EffectIntensity
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private streak = new PitchStreak()
  private resetTimer: ReturnType<typeof setTimeout> | null = null
  private typeBuffer: AudioBuffer | null = null
  private enterBuffer: AudioBuffer | null = null
  private loadingBuffers: Promise<void> | null = null
  private customTypeBuffer: AudioBuffer | null = null
  private customSpaceBuffer: AudioBuffer | null = null
  private customEnterBuffer: AudioBuffer | null = null
  private customDeleteBuffer: AudioBuffer | null = null
  private customPasteBuffer: AudioBuffer | null = null
  private loadingCustomBuffers: Promise<void> | null = null
  private customBufferKey = ''

  play(event: TypingEffectEvent, options: AudioEngineOptions): boolean {
    if (!options.enabled || !options.soundEnabled) return false
    if (options.soundStyle === 'muted') return false

    try {
      const ctx = this.ensureContext()
      if (!ctx) return false
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})

      const pitch = this.nextPitch(options)
      if (options.soundStyle === 'procedural') {
        playSynthFallback(ctx, event.type, pitch, options.effectIntensity, options.volume)
        return true
      }

      if (options.soundStyle === 'custom') {
        const customBuffer = this.customBufferFor(event, options)
        if (customBuffer) {
          playBuffer(ctx, customBuffer, pitch, sampleGainFor(options.effectIntensity, options.volume))
          return true
        }
        void this.loadCustomBuffers(ctx, options)
      }

      if (event.type === 'delete') return false

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
    this.customTypeBuffer = null
    this.customSpaceBuffer = null
    this.customEnterBuffer = null
    this.customDeleteBuffer = null
    this.customPasteBuffer = null
    this.loadingCustomBuffers = null
    this.customBufferKey = ''
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

  private nextPitch(options: Pick<AudioEngineOptions, 'pitchMax' | 'pitchRiseSteps' | 'pitchResetMs'>): number {
    const pitch = this.streak.nextPitch(options.pitchRiseSteps, options.pitchMax)
    if (this.resetTimer) clearTimeout(this.resetTimer)
    this.resetTimer = setTimeout(() => this.streak.reset(), Math.max(50, options.pitchResetMs))
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

  private customBufferFor(event: TypingEffectEvent, options: AudioEngineOptions): AudioBuffer | null {
    const key = customSoundKey(options)
    if (key !== this.customBufferKey) {
      this.customTypeBuffer = null
      this.customSpaceBuffer = null
      this.customEnterBuffer = null
      this.customDeleteBuffer = null
      this.customPasteBuffer = null
      this.loadingCustomBuffers = null
      this.customBufferKey = key
      return null
    }

    if (event.type === 'enter') return this.customEnterBuffer ?? this.customTypeBuffer
    if (event.type === 'delete') return this.customDeleteBuffer
    if (event.type === 'chunk') return this.customPasteBuffer ?? this.customTypeBuffer
    if (event.type === 'char' && event.text === ' ') return this.customSpaceBuffer ?? this.customTypeBuffer
    return this.customTypeBuffer
  }

  private loadCustomBuffers(ctx: AudioContext, options: AudioEngineOptions): Promise<void> {
    const key = customSoundKey(options)
    if (!key) return Promise.resolve()
    if (key !== this.customBufferKey) {
      this.customBufferKey = key
      this.customTypeBuffer = null
      this.customSpaceBuffer = null
      this.customEnterBuffer = null
      this.customDeleteBuffer = null
      this.customPasteBuffer = null
      this.loadingCustomBuffers = null
    }
    if (this.loadingCustomBuffers) return this.loadingCustomBuffers

    this.loadingCustomBuffers = Promise.all([
      decodeOptionalDataUrlAudio(ctx, options.customTypeSoundDataUrl),
      decodeOptionalDataUrlAudio(ctx, options.customSpaceSoundDataUrl),
      decodeOptionalDataUrlAudio(ctx, options.customEnterSoundDataUrl),
      decodeOptionalDataUrlAudio(ctx, options.customDeleteSoundDataUrl),
      decodeOptionalDataUrlAudio(ctx, options.customPasteSoundDataUrl)
    ]).then(([typeBuffer, spaceBuffer, enterBuffer, deleteBuffer, pasteBuffer]) => {
      this.customTypeBuffer = typeBuffer
      this.customSpaceBuffer = spaceBuffer
      this.customEnterBuffer = enterBuffer
      this.customDeleteBuffer = deleteBuffer
      this.customPasteBuffer = pasteBuffer
    }).catch(() => {
      this.customTypeBuffer = null
      this.customSpaceBuffer = null
      this.customEnterBuffer = null
      this.customDeleteBuffer = null
      this.customPasteBuffer = null
      this.loadingCustomBuffers = null
    })

    return this.loadingCustomBuffers
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

async function decodeOptionalDataUrlAudio(ctx: AudioContext, dataUrl: string | null): Promise<AudioBuffer | null> {
  if (!dataUrl) return null
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return null
  return decodeBase64Audio(ctx, dataUrl.slice(commaIndex + 1))
}

function customSoundKey(options: AudioEngineOptions): string {
  return [
    options.customTypeSoundDataUrl ?? '',
    options.customSpaceSoundDataUrl ?? '',
    options.customEnterSoundDataUrl ?? '',
    options.customDeleteSoundDataUrl ?? '',
    options.customPasteSoundDataUrl ?? ''
  ].join('|')
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
