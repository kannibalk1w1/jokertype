export type EffectIntensity = 'low' | 'medium' | 'high'
export type JokerTypePreset = 'subtle' | 'classic' | 'chaotic' | 'sound-only'
export type SoundStyle = 'sampled' | 'procedural' | 'muted'
export type VisualTheme = 'arcade' | 'neon' | 'monochrome' | 'terminal'

export interface JokerTypeSettings {
  soundEnabled: boolean
  soundStyle: SoundStyle
  volume: number
  visualTheme: VisualTheme
  effectIntensity: EffectIntensity
  textGlyphsEnabled: boolean
  enterEffectsEnabled: boolean
  deleteEffectsEnabled: boolean
  glyphLifetimeMs: number
  cornerBracketsEnabled: boolean
  reducedMotion: boolean
  editorShake: boolean
  statusComboEnabled: boolean
  throttleLargeChanges: boolean
  preset: JokerTypePreset
}

export const DEFAULT_SETTINGS: JokerTypeSettings = {
  soundEnabled: true,
  soundStyle: 'sampled',
  volume: 0.75,
  visualTheme: 'arcade',
  effectIntensity: 'medium',
  textGlyphsEnabled: true,
  enterEffectsEnabled: true,
  deleteEffectsEnabled: true,
  glyphLifetimeMs: 1200,
  cornerBracketsEnabled: false,
  reducedMotion: false,
  editorShake: false,
  statusComboEnabled: false,
  throttleLargeChanges: true,
  preset: 'classic'
}

export const PRESET_SETTINGS: Record<JokerTypePreset, Partial<JokerTypeSettings>> = {
  subtle: {
    soundEnabled: true,
    soundStyle: 'sampled',
    volume: 0.45,
    visualTheme: 'monochrome',
    effectIntensity: 'low',
    textGlyphsEnabled: true,
    enterEffectsEnabled: true,
    deleteEffectsEnabled: true,
    glyphLifetimeMs: 900,
    cornerBracketsEnabled: false,
    editorShake: false,
    statusComboEnabled: false,
    throttleLargeChanges: true
  },
  classic: {
    soundEnabled: true,
    soundStyle: 'sampled',
    volume: 0.75,
    visualTheme: 'arcade',
    effectIntensity: 'medium',
    textGlyphsEnabled: true,
    enterEffectsEnabled: true,
    deleteEffectsEnabled: true,
    glyphLifetimeMs: 1200,
    cornerBracketsEnabled: false,
    editorShake: false,
    statusComboEnabled: false,
    throttleLargeChanges: true
  },
  chaotic: {
    soundEnabled: true,
    soundStyle: 'sampled',
    volume: 0.9,
    visualTheme: 'neon',
    effectIntensity: 'high',
    textGlyphsEnabled: true,
    enterEffectsEnabled: true,
    deleteEffectsEnabled: true,
    glyphLifetimeMs: 1600,
    cornerBracketsEnabled: true,
    editorShake: true,
    statusComboEnabled: true,
    throttleLargeChanges: true
  },
  'sound-only': {
    soundEnabled: true,
    soundStyle: 'sampled',
    volume: 0.75,
    visualTheme: 'terminal',
    textGlyphsEnabled: false,
    enterEffectsEnabled: false,
    deleteEffectsEnabled: false,
    cornerBracketsEnabled: false,
    editorShake: false,
    statusComboEnabled: true,
    throttleLargeChanges: true
  }
}

export function applyPreset(settings: JokerTypeSettings, preset: JokerTypePreset): JokerTypeSettings {
  return {
    ...settings,
    ...PRESET_SETTINGS[preset],
    preset
  }
}
