import { Plugin } from 'obsidian'
import { Compartment, type Extension } from '@codemirror/state'
import { AudioEngine } from './audioEngine'
import { createTypingEffectExtension } from './typingEffectExtension'
import { DEFAULT_SETTINGS, JokerTypeSettingTab, type JokerTypeSettings } from './settings'

export default class JokerTypePlugin extends Plugin {
  settings: JokerTypeSettings = { ...DEFAULT_SETTINGS }
  private extensionCompartment = new Compartment()
  private audio = new AudioEngine()

  async onload(): Promise<void> {
    await this.loadSettings()
    this.addSettingTab(new JokerTypeSettingTab(this.app, this))
    this.registerEditorExtension(this.extensionCompartment.of(this.createExtension()))
  }

  onunload(): void {
    this.audio.dispose()
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }

  refreshExtension(): void {
    this.app.workspace.updateOptions()
  }

  private createExtension(): Extension {
    return createTypingEffectExtension({
      getSettings: () => this.settings,
      audio: this.audio
    })
  }
}
