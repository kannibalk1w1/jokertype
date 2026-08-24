import { App, PluginSettingTab, Setting } from 'obsidian'
import type { SettingDefinition, SettingDefinitionItem } from 'obsidian'
import type JokerTypePlugin from './main'
import { applyMarkdownMomentDeck, applyPreset, deckForMarkdownMoments, MARKDOWN_MOMENTS, MARKDOWN_MOMENT_LABELS } from './settingsModel'
import type { EffectIntensity, JokerTypePreset, MarkdownMomentDeck, SoundStyle, VisualTheme } from './settingsModel'
import type { MarkdownMoment } from './markdownMomentClassifier'

export { applyPreset, DEFAULT_SETTINGS } from './settingsModel'
export type { EffectIntensity, JokerTypePreset, JokerTypeSettings, MarkdownMomentDeck, SoundStyle, VisualTheme } from './settingsModel'

type CustomSoundKey = 'customTypeSoundDataUrl' | 'customSpaceSoundDataUrl' | 'customEnterSoundDataUrl' | 'customDeleteSoundDataUrl' | 'customPasteSoundDataUrl'

export class JokerTypeSettingTab extends PluginSettingTab {
  plugin: JokerTypePlugin

  constructor(app: App, plugin: JokerTypePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: 'Enabled',
        desc: 'Turn all JokerType effects and sounds on or off.',
        control: { type: 'toggle', key: 'enabled' }
      },
      {
        name: 'Hotkey',
        desc: 'Assign a hotkey in Obsidian Hotkeys for the command "Toggle effects".',
        render: (setting) => {
          setting.addButton((button) => {
            button
              .setButtonText(this.plugin.settings.enabled ? 'Disable now' : 'Enable now')
              .onClick(() => {
                void this.plugin.toggleEnabled().then(() => this.refreshSettings())
              })
          })
        }
      },
      {
        name: 'Preset',
        desc: 'Apply a ready-made JokerType feel.',
        control: {
          type: 'dropdown',
          key: 'preset',
          options: {
            subtle: 'Subtle',
            classic: 'Classic',
            chaotic: 'Chaotic',
            'sound-only': 'Sound only',
            prism: 'Prism'
          }
        }
      },
      {
        name: 'Test effect',
        desc: 'Play a short preview in the active editor, including every enabled Markdown Moment.',
        render: (setting) => {
          setting.addButton((button) => {
            button.setButtonText('Test').onClick(() => this.plugin.triggerTestEffect())
          })
        }
      },
      {
        type: 'group',
        heading: 'Sound',
        items: [
          { name: 'Sound', desc: 'Play typing sounds.', control: { type: 'toggle', key: 'soundEnabled' } },
          {
            name: 'Sound style',
            desc: 'Choose sampled HyperType-style sounds, procedural sounds, or silence.',
            control: {
              type: 'dropdown',
              key: 'soundStyle',
              options: { sampled: 'Sampled', procedural: 'Procedural', custom: 'Custom', muted: 'Muted' }
            }
          },
          this.customSoundDefinition('Custom typing sound', 'customTypeSoundDataUrl', 'Upload an audio file for normal typing sounds.'),
          this.customSoundDefinition('Custom space sound', 'customSpaceSoundDataUrl', 'Optional audio file for Space. If empty, JokerType reuses the typing sound.'),
          this.customSoundDefinition('Custom enter sound', 'customEnterSoundDataUrl', 'Optional audio file for Enter. If empty, JokerType reuses the typing sound.'),
          this.customSoundDefinition('Custom backspace/delete sound', 'customDeleteSoundDataUrl', 'Optional audio file for Backspace and Delete. If empty, those keys stay quiet.'),
          this.customSoundDefinition('Custom paste sound', 'customPasteSoundDataUrl', 'Optional audio file for paste and other large edits. If empty, JokerType reuses the typing sound.'),
          { name: 'Volume', desc: 'Controls typing sound volume.', control: { type: 'slider', key: 'volume', min: 0, max: 1, step: 0.05 } },
          { name: 'Max pitch', desc: 'Highest pitch multiplier reached during a fast typing streak.', control: { type: 'slider', key: 'pitchMax', min: 1, max: 1.6, step: 0.05 } },
          { name: 'Pitch rise steps', desc: 'How many rapid keystrokes it takes to reach maximum pitch.', control: { type: 'slider', key: 'pitchRiseSteps', min: 3, max: 80, step: 1 } },
          { name: 'Pitch reset delay', desc: 'How long the pitch streak survives after typing pauses.', control: { type: 'slider', key: 'pitchResetMs', min: 150, max: 1200, step: 50 } }
        ]
      },
      {
        type: 'group',
        heading: 'Visual effects',
        items: [
          {
            name: 'Visual theme',
            desc: 'Choose the color language for glyph particles.',
            control: {
              type: 'dropdown',
              key: 'visualTheme',
              options: { arcade: 'Arcade', neon: 'Neon', monochrome: 'Monochrome', terminal: 'Terminal', prism: 'Prism' }
            }
          },
          {
            name: 'Effect intensity',
            desc: 'Controls particle count, motion distance, and sound gain.',
            control: { type: 'dropdown', key: 'effectIntensity', options: { low: 'Low', medium: 'Medium', high: 'High' } }
          },
          { name: 'Text glyphs', desc: 'Show floating text labels while typing.', control: { type: 'toggle', key: 'textGlyphsEnabled' } },
          { name: 'Enter effects', desc: 'Show special ENTER visuals.', control: { type: 'toggle', key: 'enterEffectsEnabled' } },
          { name: 'Delete effects', desc: 'Show BACKSPACE and DELETE visuals.', control: { type: 'toggle', key: 'deleteEffectsEnabled' } },
          { name: 'Glyph lifetime', desc: 'How long typed glyphs remain visible before fading.', control: { type: 'slider', key: 'glyphLifetimeMs', min: 500, max: 2400, step: 100 } },
          { name: 'Corner brackets', desc: 'Show HyperType-style bracket bursts around typed glyphs.', control: { type: 'toggle', key: 'cornerBracketsEnabled' } },
          { name: 'Reduced motion', desc: 'Replace movement-heavy effects with subtle pulses.', control: { type: 'toggle', key: 'reducedMotion' } },
          { name: 'Editor shake', desc: 'Shake the active editor on stronger effects. Off by default.', control: { type: 'toggle', key: 'editorShake' } },
          { name: 'Status combo counter', desc: 'Show a temporary typing streak in the Obsidian status bar.', control: { type: 'toggle', key: 'statusComboEnabled' } },
          { name: 'Large paste throttle', desc: 'Collapse large edits into one PASTE effect instead of many particles.', control: { type: 'toggle', key: 'throttleLargeChanges' } }
        ]
      },
      {
        type: 'group',
        heading: 'Markdown Moments',
        items: [
          {
            name: 'Moment deck',
            desc: 'Choose a starting deck, then fine-tune every Moment below. Pasted text stays quiet.',
            control: {
              type: 'dropdown',
              key: 'markdownMomentDeck',
              options: { off: 'Off', essentials: 'Essentials', 'full-deck': 'Full Deck', custom: 'Custom' }
            }
          },
          ...MARKDOWN_MOMENTS.map((moment) => ({
            name: MARKDOWN_MOMENT_LABELS[moment],
            control: { type: 'toggle' as const, key: `markdownMoment:${moment}` }
          }))
        ]
      }
    ]
  }

  getControlValue(key: string): unknown {
    if (key.startsWith('markdownMoment:')) {
      return this.plugin.settings.markdownMomentEnabled[key.slice('markdownMoment:'.length) as MarkdownMoment]
    }
    return (this.plugin.settings as unknown as Record<string, unknown>)[key]
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    let refresh = false
    if (key === 'preset') {
      this.plugin.settings = applyPreset(this.plugin.settings, value as JokerTypePreset)
      refresh = true
    } else if (key === 'soundStyle') {
      this.plugin.settings.soundStyle = value as SoundStyle
      this.plugin.settings.soundEnabled = value !== 'muted'
    } else if (key === 'markdownMomentDeck') {
      if (value !== 'custom') {
        this.plugin.settings = applyMarkdownMomentDeck(this.plugin.settings, value as Exclude<MarkdownMomentDeck, 'custom'>)
        refresh = true
      }
    } else if (key.startsWith('markdownMoment:')) {
      const moment = key.slice('markdownMoment:'.length) as MarkdownMoment
      this.plugin.settings.markdownMomentEnabled = { ...this.plugin.settings.markdownMomentEnabled, [moment]: Boolean(value) }
      this.plugin.settings.markdownMomentDeck = deckForMarkdownMoments(this.plugin.settings.markdownMomentEnabled)
      refresh = true
    } else {
      (this.plugin.settings as unknown as Record<string, unknown>)[key] = value
    }

    await this.plugin.saveSettings()
    this.plugin.refreshExtension()
    if (refresh) this.refreshSettings()
  }

  display(): void {
    this.renderLegacySettings()
  }

  private refreshSettings(): void {
    const update = (this as unknown as { update?: () => void }).update
    if (update) update.call(this)
    else this.renderLegacySettings()
  }

  private renderLegacySettings(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Enabled')
      .setDesc('Turn all JokerType effects and sounds on or off.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange(async (value) => {
            this.plugin.settings.enabled = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Hotkey')
      .setDesc('Assign a hotkey in Obsidian Hotkeys for the command "Toggle effects".')
      .addButton((button) => {
        button
          .setButtonText(this.plugin.settings.enabled ? 'Disable now' : 'Enable now')
          .onClick(() => {
            void this.plugin.toggleEnabled().then(() => this.refreshSettings())
          })
      })

    new Setting(containerEl)
      .setName('Preset')
      .setDesc('Apply a ready-made JokerType feel.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('subtle', 'Subtle')
          .addOption('classic', 'Classic')
          .addOption('chaotic', 'Chaotic')
          .addOption('sound-only', 'Sound only')
          .addOption('prism', 'Prism')
          .setValue(this.plugin.settings.preset)
          .onChange(async (value) => {
            this.plugin.settings = applyPreset(this.plugin.settings, value as JokerTypePreset)
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.refreshSettings()
          })
      })

    new Setting(containerEl)
      .setName('Test effect')
      .setDesc('Play a short preview in the active editor, including every enabled Markdown Moment.')
      .addButton((button) => {
        button
          .setButtonText('Test')
          .onClick(() => {
            this.plugin.triggerTestEffect()
          })
      })

    new Setting(containerEl)
      .setName('Sound')
      .setDesc('Play typing sounds.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.soundEnabled)
          .onChange(async (value) => {
            this.plugin.settings.soundEnabled = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Sound style')
      .setDesc('Choose sampled HyperType-style sounds, procedural sounds, or silence.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('sampled', 'Sampled')
          .addOption('procedural', 'Procedural')
          .addOption('custom', 'Custom')
          .addOption('muted', 'Muted')
          .setValue(this.plugin.settings.soundStyle)
          .onChange(async (value) => {
            this.plugin.settings.soundStyle = value as SoundStyle
            this.plugin.settings.soundEnabled = value !== 'muted'
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.refreshSettings()
          })
      })

    new Setting(containerEl)
      .setName('Custom typing sound')
      .setDesc(this.plugin.settings.customTypeSoundDataUrl ? 'Custom typing sound loaded.' : 'Upload an audio file for normal typing sounds.')
      .addButton((button) => {
        button
          .setButtonText('Upload')
          .onClick(() => {
            this.pickSoundFile(async (dataUrl) => {
              this.plugin.settings.customTypeSoundDataUrl = dataUrl
              this.plugin.settings.soundStyle = 'custom'
              this.plugin.settings.soundEnabled = true
              await this.plugin.saveSettings()
              this.plugin.refreshExtension()
            this.refreshSettings()
            })
          })
      })
      .addButton((button) => {
        button
          .setButtonText('Clear')
          .setDisabled(!this.plugin.settings.customTypeSoundDataUrl)
          .onClick(async () => {
            this.plugin.settings.customTypeSoundDataUrl = null
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.refreshSettings()
          })
      })

    this.addCustomSoundSetting('Custom space sound', 'customSpaceSoundDataUrl', 'Optional audio file for Space. If empty, JokerType reuses the typing sound.')

    new Setting(containerEl)
      .setName('Custom enter sound')
      .setDesc(this.plugin.settings.customEnterSoundDataUrl ? 'Custom enter sound loaded.' : 'Optional audio file for Enter. If empty, JokerType reuses the typing sound.')
      .addButton((button) => {
        button
          .setButtonText('Upload')
          .onClick(() => {
            this.pickSoundFile(async (dataUrl) => {
              this.plugin.settings.customEnterSoundDataUrl = dataUrl
              this.plugin.settings.soundStyle = 'custom'
              this.plugin.settings.soundEnabled = true
              await this.plugin.saveSettings()
              this.plugin.refreshExtension()
            this.refreshSettings()
            })
          })
      })
      .addButton((button) => {
        button
          .setButtonText('Clear')
          .setDisabled(!this.plugin.settings.customEnterSoundDataUrl)
          .onClick(async () => {
            this.plugin.settings.customEnterSoundDataUrl = null
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.refreshSettings()
          })
      })

    this.addCustomSoundSetting('Custom backspace/delete sound', 'customDeleteSoundDataUrl', 'Optional audio file for Backspace and Delete. If empty, those keys stay quiet.')

    this.addCustomSoundSetting('Custom paste sound', 'customPasteSoundDataUrl', 'Optional audio file for paste and other large edits. If empty, JokerType reuses the typing sound.')

    new Setting(containerEl)
      .setName('Volume')
      .setDesc('Controls typing sound volume.')
      .addSlider((slider) => {
        slider
          .setLimits(0, 1, 0.05)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.volume)
          .onChange(async (value) => {
            this.plugin.settings.volume = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Max pitch')
      .setDesc('Highest pitch multiplier reached during a fast typing streak.')
      .addSlider((slider) => {
        slider
          .setLimits(1, 1.6, 0.05)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.pitchMax)
          .onChange(async (value) => {
            this.plugin.settings.pitchMax = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Pitch rise steps')
      .setDesc('How many rapid keystrokes it takes to reach maximum pitch.')
      .addSlider((slider) => {
        slider
          .setLimits(3, 80, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.pitchRiseSteps)
          .onChange(async (value) => {
            this.plugin.settings.pitchRiseSteps = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Pitch reset delay')
      .setDesc('How long the pitch streak survives after typing pauses.')
      .addSlider((slider) => {
        slider
          .setLimits(150, 1200, 50)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.pitchResetMs)
          .onChange(async (value) => {
            this.plugin.settings.pitchResetMs = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Visual theme')
      .setDesc('Choose the color language for glyph particles.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('arcade', 'Arcade')
          .addOption('neon', 'Neon')
          .addOption('monochrome', 'Monochrome')
          .addOption('terminal', 'Terminal')
          .addOption('prism', 'Prism')
          .setValue(this.plugin.settings.visualTheme)
          .onChange(async (value) => {
            this.plugin.settings.visualTheme = value as VisualTheme
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Effect intensity')
      .setDesc('Controls particle count, motion distance, and sound gain.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('low', 'Low')
          .addOption('medium', 'Medium')
          .addOption('high', 'High')
          .setValue(this.plugin.settings.effectIntensity)
          .onChange(async (value) => {
            this.plugin.settings.effectIntensity = value as EffectIntensity
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Text glyphs')
      .setDesc('Show floating text labels while typing.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.textGlyphsEnabled)
          .onChange(async (value) => {
            this.plugin.settings.textGlyphsEnabled = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Enter effects')
      .setDesc('Show special ENTER visuals.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enterEffectsEnabled)
          .onChange(async (value) => {
            this.plugin.settings.enterEffectsEnabled = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Delete effects')
      .setDesc('Show BACKSPACE and DELETE visuals.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.deleteEffectsEnabled)
          .onChange(async (value) => {
            this.plugin.settings.deleteEffectsEnabled = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Glyph lifetime')
      .setDesc('How long typed glyphs remain visible before fading.')
      .addSlider((slider) => {
        slider
          .setLimits(500, 2400, 100)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.glyphLifetimeMs)
          .onChange(async (value) => {
            this.plugin.settings.glyphLifetimeMs = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Corner brackets')
      .setDesc('Show HyperType-style bracket bursts around typed glyphs.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.cornerBracketsEnabled)
          .onChange(async (value) => {
            this.plugin.settings.cornerBracketsEnabled = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Status combo counter')
      .setDesc('Show a temporary typing streak in the Obsidian status bar.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.statusComboEnabled)
          .onChange(async (value) => {
            this.plugin.settings.statusComboEnabled = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Large paste throttle')
      .setDesc('Collapse large edits into one PASTE effect instead of many particles.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.throttleLargeChanges)
          .onChange(async (value) => {
            this.plugin.settings.throttleLargeChanges = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Markdown Moments')
      .setHeading()

    new Setting(containerEl)
      .setName('Moment deck')
      .setDesc('Choose a starting deck, then fine-tune every Moment below. Pasted text stays quiet.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('off', 'Off')
          .addOption('essentials', 'Essentials')
          .addOption('full-deck', 'Full Deck')
          .addOption('custom', 'Custom')
          .setValue(this.plugin.settings.markdownMomentDeck)
          .onChange(async (value) => {
            if (value === 'custom') return
            this.plugin.settings = applyMarkdownMomentDeck(this.plugin.settings, value as Exclude<MarkdownMomentDeck, 'custom'>)
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.refreshSettings()
          })
      })

    for (const moment of MARKDOWN_MOMENTS) this.addMarkdownMomentSetting(moment)

    new Setting(containerEl)
      .setName('Reduced motion')
      .setDesc('Replace movement-heavy effects with subtle pulses.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.reducedMotion)
          .onChange(async (value) => {
            this.plugin.settings.reducedMotion = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })

    new Setting(containerEl)
      .setName('Editor shake')
      .setDesc('Shake the active editor on stronger effects. Off by default.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.editorShake)
          .onChange(async (value) => {
            this.plugin.settings.editorShake = value
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
          })
      })
  }

  private customSoundDefinition(name: string, key: CustomSoundKey, emptyDescription: string): SettingDefinition {
    return {
      name,
      desc: this.plugin.settings[key] ? `${name.replace('Custom ', '')} loaded.` : emptyDescription,
      render: (setting) => {
        setting
          .addButton((button) => {
            button.setButtonText('Upload').onClick(() => {
              this.pickSoundFile(async (dataUrl) => {
                this.plugin.settings[key] = dataUrl
                this.plugin.settings.soundStyle = 'custom'
                this.plugin.settings.soundEnabled = true
                await this.plugin.saveSettings()
                this.plugin.refreshExtension()
                this.refreshSettings()
              })
            })
          })
          .addButton((button) => {
            button.setButtonText('Clear').setDisabled(!this.plugin.settings[key]).onClick(async () => {
              this.plugin.settings[key] = null
              await this.plugin.saveSettings()
              this.plugin.refreshExtension()
              this.refreshSettings()
            })
          })
      }
    }
  }

  private addCustomSoundSetting(name: string, key: CustomSoundKey, emptyDescription: string): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(this.plugin.settings[key] ? `${name.replace('Custom ', '')} loaded.` : emptyDescription)
      .addButton((button) => {
        button
          .setButtonText('Upload')
          .onClick(() => {
            this.pickSoundFile(async (dataUrl) => {
              this.plugin.settings[key] = dataUrl
              this.plugin.settings.soundStyle = 'custom'
              this.plugin.settings.soundEnabled = true
              await this.plugin.saveSettings()
              this.plugin.refreshExtension()
            this.refreshSettings()
            })
          })
      })
      .addButton((button) => {
        button
          .setButtonText('Clear')
          .setDisabled(!this.plugin.settings[key])
          .onClick(async () => {
            this.plugin.settings[key] = null
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.refreshSettings()
          })
      })
  }

  private addMarkdownMomentSetting(moment: MarkdownMoment): void {
    new Setting(this.containerEl)
      .setName(MARKDOWN_MOMENT_LABELS[moment])
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.markdownMomentEnabled[moment])
          .onChange(async (value) => {
            this.plugin.settings.markdownMomentEnabled = { ...this.plugin.settings.markdownMomentEnabled, [moment]: value }
            this.plugin.settings.markdownMomentDeck = deckForMarkdownMoments(this.plugin.settings.markdownMomentEnabled)
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.refreshSettings()
          })
      })
  }

  private pickSoundFile(onLoad: (dataUrl: string) => void | Promise<void>): void {
    const input = this.containerEl.createEl('input', { attr: { type: 'file', accept: 'audio/*' } })
    input.addClass('jokertype-file-input')
    input.onchange = () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') void onLoad(reader.result)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }
}
