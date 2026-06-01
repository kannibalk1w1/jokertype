import { App, PluginSettingTab, Setting } from 'obsidian'
import type JokerTypePlugin from './main'

export type EffectIntensity = 'low' | 'medium' | 'high'

export interface JokerTypeSettings {
  soundEnabled: boolean
  effectIntensity: EffectIntensity
  reducedMotion: boolean
  editorShake: boolean
  preset: 'classic'
}

export const DEFAULT_SETTINGS: JokerTypeSettings = {
  soundEnabled: true,
  effectIntensity: 'medium',
  reducedMotion: false,
  editorShake: false,
  preset: 'classic'
}

export class JokerTypeSettingTab extends PluginSettingTab {
  plugin: JokerTypePlugin

  constructor(app: App, plugin: JokerTypePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl('h2', { text: 'JokerType' })

    new Setting(containerEl)
      .setName('Sound')
      .setDesc('Play low-volume procedural typing sounds.')
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

    new Setting(containerEl)
      .setName('Preset')
      .setDesc('The MVP ships with the Classic visual preset.')
      .addDropdown((dropdown) => {
        dropdown.addOption('classic', 'Classic').setValue('classic').setDisabled(true)
      })
  }
}
