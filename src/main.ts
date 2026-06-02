import { Editor, MarkdownView, Notice, Plugin } from 'obsidian'
import { Compartment, type Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { AudioEngine } from './audioEngine'
import { EffectOverlay } from './effectOverlay'
import { createTypingEffectExtension } from './typingEffectExtension'
import { classifyTextChange } from './changeClassifier'
import type { TypingEffectEvent } from './changeClassifier'
import { DEFAULT_SETTINGS, JokerTypeSettingTab, type JokerTypeSettings } from './settings'

export default class JokerTypePlugin extends Plugin {
  settings: JokerTypeSettings = { ...DEFAULT_SETTINGS }
  private extensionCompartment = new Compartment()
  private audio = new AudioEngine()
  private statusEl: HTMLElement | null = null
  private eventCount = 0
  private spawnCount = 0
  private missedCoordCount = 0
  private audioCount = 0
  private lastCmEventAt = 0
  private fallbackOverlays = new WeakMap<EditorView, EffectOverlay>()
  private fallbackOverlaySet = new Set<EffectOverlay>()
  private fallbackEditorLengths = new WeakMap<Editor, number>()
  private comboCount = 0
  private comboResetTimer: number | null = null

  async onload(): Promise<void> {
    await this.loadSettings()
    this.statusEl = this.addStatusBarItem()
    this.updateStatus()
    this.addSettingTab(new JokerTypeSettingTab(this.app, this))
    this.registerEditorExtension(this.extensionCompartment.of(this.createExtension()))
    this.registerEvent(this.app.workspace.on('editor-change', (editor) => this.handleEditorChange(editor)))
    this.app.workspace.updateOptions()
  }

  onunload(): void {
    for (const overlay of this.fallbackOverlaySet) overlay.destroy()
    this.fallbackOverlaySet.clear()
    if (this.comboResetTimer) clearTimeout(this.comboResetTimer)
    this.comboResetTimer = null
    this.audio.dispose()
  }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData()
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved)
    if (this.shouldDefaultToReducedMotion(saved)) {
      this.settings.reducedMotion = true
      this.settings.editorShake = false
      this.settings.cornerBracketsEnabled = false
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }

  refreshExtension(): void {
    this.app.workspace.updateOptions()
    this.updateStatus()
  }

  triggerTestEffect(): void {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
    const editor = markdownView?.editor
    if (!editor) {
      new Notice('Open an editor to preview JokerType.')
      return
    }

    const view = this.editorViewFrom(editor)
    if (!view) {
      new Notice('JokerType preview needs an active editing view.')
      return
    }

    const offset = editor.posToOffset(editor.getCursor())
    const events: TypingEffectEvent[] = [
      { type: 'char', text: 'J', from: offset, to: offset + 1 },
      { type: 'char', text: ' ', from: offset, to: offset + 1 },
      { type: 'enter', from: offset },
      { type: 'chunk', text: 'preview', from: offset, length: 7, reason: 'unknown' }
    ]
    const overlay = this.fallbackOverlayFor(view)

    events.forEach((event, index) => {
      window.setTimeout(() => {
        overlay.spawn(event, this.settings)
        this.audio.play(event, this.settings)
        this.registerCombo(1)
      }, index * 95)
    })
  }

  private createExtension(): Extension {
    return createTypingEffectExtension({
      getSettings: () => this.settings,
      audio: this.audio,
      onEvents: (stats) => this.recordEvents(stats)
    })
  }

  private recordEvents(stats: { events: number; spawned: number; missedCoords: number; audio: number }): void {
    this.lastCmEventAt = Date.now()
    this.eventCount += stats.events
    this.spawnCount += stats.spawned
    this.missedCoordCount += stats.missedCoords
    this.audioCount += stats.audio
    this.registerCombo(stats.events)
    this.updateStatus()
  }

  private handleEditorChange(editor: Editor): void {
    window.setTimeout(() => {
      if (Date.now() - this.lastCmEventAt < 50) return

      const view = this.editorViewFrom(editor)
      if (!view) return

      const cursor = editor.getCursor()
      const offset = editor.posToOffset(cursor)
      const currentLength = editor.getValue().length
      const previousLength = this.fallbackEditorLengths.get(editor)
      this.fallbackEditorLengths.set(editor, currentLength)

      const events = this.fallbackEventsFor(editor, offset, previousLength, currentLength)
      if (events.length === 0) return

      const overlay = this.fallbackOverlayFor(view)
      let spawned = 0
      let audio = 0
      for (const event of events) {
        if (overlay.spawn(event, this.settings)) spawned += 1
        if (this.audio.play(event, this.settings)) audio += 1
      }
      this.eventCount += events.length
      this.spawnCount += spawned
      this.missedCoordCount += events.length - spawned
      this.audioCount += audio
      this.registerCombo(events.length)
      this.updateStatus()
    }, 0)
  }

  private fallbackEventsFor(editor: Editor, offset: number, previousLength: number | undefined, currentLength: number): TypingEffectEvent[] {
    if (previousLength === undefined) {
      const from = Math.max(0, offset - 1)
      const inserted = offset > 0 ? editor.getRange(editor.offsetToPos(from), editor.offsetToPos(offset)) : ''
      return classifyTextChange({ from, to: offset, inserted, throttleLargeChanges: this.settings.throttleLargeChanges })
    }

    if (currentLength < previousLength) {
      return [{
        type: 'delete',
        from: offset,
        to: offset + (previousLength - currentLength),
        direction: 'backward'
      }]
    }

    if (currentLength > previousLength) {
      const insertedLength = currentLength - previousLength
      const from = Math.max(0, offset - insertedLength)
      const inserted = editor.getRange(editor.offsetToPos(from), editor.offsetToPos(offset))
      return classifyTextChange({ from, to: offset, inserted, throttleLargeChanges: this.settings.throttleLargeChanges })
    }

    return []
  }

  private editorViewFrom(editor: Editor): EditorView | null {
    const maybeEditor = editor as unknown as { cm?: EditorView }
    return maybeEditor.cm ?? null
  }

  private fallbackOverlayFor(view: EditorView): EffectOverlay {
    const existing = this.fallbackOverlays.get(view)
    if (existing) return existing

    const overlay = new EffectOverlay(view)
    this.fallbackOverlays.set(view, overlay)
    this.fallbackOverlaySet.add(overlay)
    return overlay
  }

  private updateStatus(): void {
    if (!this.statusEl) return
    if (this.settings.statusComboEnabled && this.comboCount > 1) {
      this.statusEl.setText(`JokerType x${this.comboCount}`)
      return
    }
    this.statusEl.setText('JokerType')
  }

  private registerCombo(events: number): void {
    if (!this.settings.statusComboEnabled || events <= 0) return
    this.comboCount += events
    if (this.comboResetTimer) clearTimeout(this.comboResetTimer)
    this.comboResetTimer = window.setTimeout(() => {
      this.comboCount = 0
      this.updateStatus()
    }, 900)
  }

  private shouldDefaultToReducedMotion(saved: Partial<JokerTypeSettings> | null): boolean {
    if (saved && 'reducedMotion' in saved) return false
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const isMobile = 'isMobile' in this.app ? Boolean(this.app.isMobile) : false
    return prefersReducedMotion || isMobile
  }
}
