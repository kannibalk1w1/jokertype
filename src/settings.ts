import { App, PluginSettingTab, Setting } from 'obsidian'
import type JokerTypePlugin from './main'
import { applyPreset } from './settingsModel'
import type { EffectIntensity, JokerTypePreset, SoundStyle, VisualTheme } from './settingsModel'

export { applyPreset, DEFAULT_SETTINGS } from './settingsModel'
export type { EffectIntensity, JokerTypePreset, JokerTypeSettings, SoundStyle, VisualTheme } from './settingsModel'

export class JokerTypeSettingTab extends PluginSettingTab {
  plugin: JokerTypePlugin

  constructor(app: App, plugin: JokerTypePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('JokerType')
      .setHeading()

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
      .setDesc('Assign a hotkey in Obsidian Hotkeys for the command "Toggle JokerType".')
      .addButton((button) => {
        button
          .setButtonText(this.plugin.settings.enabled ? 'Disable now' : 'Enable now')
          .onClick(() => {
            void this.plugin.toggleEnabled().then(() => this.display())
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
          .setValue(this.plugin.settings.preset)
          .onChange(async (value) => {
            this.plugin.settings = applyPreset(this.plugin.settings, value as JokerTypePreset)
            await this.plugin.saveSettings()
            this.plugin.refreshExtension()
            this.display()
          })
      })

    new Setting(containerEl)
      .setName('Test effect')
      .setDesc('Play a short JokerType preview in the active editor.')
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
            this.display()
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
              this.display()
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
            this.display()
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
              this.display()
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
            this.display()
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

  private addCustomSoundSetting(name: string, key: 'customSpaceSoundDataUrl' | 'customDeleteSoundDataUrl' | 'customPasteSoundDataUrl', emptyDescription: string): void {
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
              this.display()
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
            this.display()
          })
      })
  }

  private pickSoundFile(onLoad: (dataUrl: string) => void | Promise<void>): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.onchange = () => {
      const file = input.files?.[0]
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
