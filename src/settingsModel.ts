import type { MarkdownMoment } from './markdownMomentClassifier'

export type EffectIntensity = 'low' | 'medium' | 'high'
export type JokerTypePreset = 'subtle' | 'classic' | 'chaotic' | 'sound-only' | 'prism'
export type SoundStyle = 'sampled' | 'procedural' | 'custom' | 'muted'
export type VisualTheme = 'arcade' | 'neon' | 'monochrome' | 'terminal' | 'prism'
export type MarkdownMomentDeck = 'off' | 'essentials' | 'full-deck' | 'custom'

export const MARKDOWN_MOMENTS: MarkdownMoment[] = ['title', 'linked', 'embedded', 'quest', 'cleared', 'summoned', 'locked-in', 'cited', 'dealt', 'grid']
export const ESSENTIAL_MARKDOWN_MOMENTS: MarkdownMoment[] = ['title', 'linked', 'quest', 'cleared']
export const MARKDOWN_MOMENT_LABELS: Record<MarkdownMoment, string> = {
  title: 'TITLE! — completed headings',
  linked: 'LINKED — wiki links',
  embedded: 'EMBEDDED — note embeds',
  quest: 'QUEST — new tasks',
  cleared: 'CLEARED — checked tasks',
  summoned: 'SUMMONED — callouts',
  'locked-in': 'LOCKED IN — closed code blocks',
  cited: 'CITED — footnotes',
  dealt: 'DEALT — closed frontmatter',
  grid: 'GRID! — table divider rows'
}

export interface JokerTypeSettings {
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
  markdownMomentDeck: MarkdownMomentDeck
  markdownMomentEnabled: Record<MarkdownMoment, boolean>
  preset: JokerTypePreset
}

export const DEFAULT_SETTINGS: JokerTypeSettings = {
  enabled: true,
  soundEnabled: true,
  soundStyle: 'sampled',
  volume: 0.75,
  customTypeSoundDataUrl: null,
  customSpaceSoundDataUrl: null,
  customEnterSoundDataUrl: null,
  customDeleteSoundDataUrl: null,
  customPasteSoundDataUrl: null,
  pitchMax: 1.3,
  pitchRiseSteps: 35,
  pitchResetMs: 300,
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
  markdownMomentDeck: 'off',
  markdownMomentEnabled: disabledMarkdownMoments(),
  preset: 'classic'
}

export const PRESET_SETTINGS: Record<JokerTypePreset, Partial<JokerTypeSettings>> = {
  subtle: {
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
  },
  prism: {
    enabled: true,
    soundEnabled: true,
    soundStyle: 'sampled',
    volume: 0.7,
    visualTheme: 'prism',
    effectIntensity: 'medium',
    textGlyphsEnabled: true,
    enterEffectsEnabled: true,
    deleteEffectsEnabled: true,
    glyphLifetimeMs: 1300,
    cornerBracketsEnabled: true,
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

export function applyMarkdownMomentDeck(settings: JokerTypeSettings, deck: Exclude<MarkdownMomentDeck, 'custom'>): JokerTypeSettings {
  const enabled = disabledMarkdownMoments()
  const selected = deck === 'essentials' ? ESSENTIAL_MARKDOWN_MOMENTS : deck === 'full-deck' ? MARKDOWN_MOMENTS : []
  for (const moment of selected) enabled[moment] = true
  return { ...settings, markdownMomentDeck: deck, markdownMomentEnabled: enabled }
}

export function deckForMarkdownMoments(enabled: Record<MarkdownMoment, boolean>): MarkdownMomentDeck {
  const active = MARKDOWN_MOMENTS.filter((moment) => enabled[moment])
  if (active.length === 0) return 'off'
  if (active.length === MARKDOWN_MOMENTS.length) return 'full-deck'
  if (active.length === ESSENTIAL_MARKDOWN_MOMENTS.length && ESSENTIAL_MARKDOWN_MOMENTS.every((moment) => enabled[moment])) return 'essentials'
  return 'custom'
}

function disabledMarkdownMoments(): Record<MarkdownMoment, boolean> {
  return {
    title: false,
    linked: false,
    embedded: false,
    quest: false,
    cleared: false,
    summoned: false,
    'locked-in': false,
    cited: false,
    dealt: false,
    grid: false
  }
}
