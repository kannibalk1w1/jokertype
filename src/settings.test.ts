import { describe, expect, it } from 'vitest'
import { applyMarkdownMomentDeck, applyPreset, DEFAULT_SETTINGS, deckForMarkdownMoments } from './settingsModel'

describe('applyPreset', () => {
  it('applies a preset while preserving the selected preset name', () => {
    const settings = applyPreset(DEFAULT_SETTINGS, 'chaotic')

    expect(settings.preset).toBe('chaotic')
    expect(settings.enabled).toBe(true)
    expect(settings.effectIntensity).toBe('high')
    expect(settings.visualTheme).toBe('neon')
    expect(settings.cornerBracketsEnabled).toBe(true)
    expect(settings.editorShake).toBe(true)
    expect(settings.statusComboEnabled).toBe(true)
  })

  it('can apply sound-only without muting sound', () => {
    const settings = applyPreset(DEFAULT_SETTINGS, 'sound-only')

    expect(settings.soundEnabled).toBe(true)
    expect(settings.customTypeSoundDataUrl).toBeNull()
    expect(settings.customSpaceSoundDataUrl).toBeNull()
    expect(settings.customEnterSoundDataUrl).toBeNull()
    expect(settings.customDeleteSoundDataUrl).toBeNull()
    expect(settings.customPasteSoundDataUrl).toBeNull()
    expect(settings.pitchMax).toBe(1.3)
    expect(settings.pitchRiseSteps).toBe(35)
    expect(settings.pitchResetMs).toBe(300)
    expect(settings.soundStyle).toBe('sampled')
    expect(settings.visualTheme).toBe('terminal')
    expect(settings.textGlyphsEnabled).toBe(false)
    expect(settings.enterEffectsEnabled).toBe(false)
    expect(settings.deleteEffectsEnabled).toBe(false)
  })

  it('applies the Prism preset for a colorful but calm typing streak', () => {
    const settings = applyPreset(DEFAULT_SETTINGS, 'prism')

    expect(settings.preset).toBe('prism')
    expect(settings.visualTheme).toBe('prism')
    expect(settings.cornerBracketsEnabled).toBe(true)
    expect(settings.editorShake).toBe(false)
    expect(settings.statusComboEnabled).toBe(true)
  })

  it('keeps Markdown Moments opt-in for a fresh install', () => {
    expect(DEFAULT_SETTINGS.markdownMomentDeck).toBe('off')
    expect(DEFAULT_SETTINGS.markdownMomentEnabled.title).toBe(false)
  })

  it('applies an Essentials deck and recognizes a custom selection', () => {
    const essentials = applyMarkdownMomentDeck(DEFAULT_SETTINGS, 'essentials')
    expect(essentials.markdownMomentEnabled.title).toBe(true)
    expect(essentials.markdownMomentEnabled.embedded).toBe(false)

    const custom = { ...essentials.markdownMomentEnabled, embedded: true }
    expect(deckForMarkdownMoments(custom)).toBe('custom')
    expect(deckForMarkdownMoments(applyMarkdownMomentDeck(DEFAULT_SETTINGS, 'full-deck').markdownMomentEnabled)).toBe('full-deck')
  })
})
