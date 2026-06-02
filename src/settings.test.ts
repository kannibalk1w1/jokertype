import { describe, expect, it } from 'vitest'
import { applyPreset, DEFAULT_SETTINGS } from './settingsModel'

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
    expect(settings.customEnterSoundDataUrl).toBeNull()
    expect(settings.soundStyle).toBe('sampled')
    expect(settings.visualTheme).toBe('terminal')
    expect(settings.textGlyphsEnabled).toBe(false)
    expect(settings.enterEffectsEnabled).toBe(false)
    expect(settings.deleteEffectsEnabled).toBe(false)
  })
})
