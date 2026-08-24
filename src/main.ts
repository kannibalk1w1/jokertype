import { Editor, MarkdownView, Notice, Plugin } from 'obsidian'
import { EditorView } from '@codemirror/view'
import { AudioEngine } from './audioEngine'
import { EffectOverlay } from './effectOverlay'
import { classifyTextChange, momentEffectEvent } from './changeClassifier'
import type { TypingEffectEvent } from './changeClassifier'
import { detectMarkdownMoment } from './markdownMomentClassifier'
import { DEFAULT_SETTINGS, JokerTypeSettingTab, type JokerTypeSettings } from './settings'
import { applyMarkdownMomentDeck, MARKDOWN_MOMENTS } from './settingsModel'

export default class JokerTypePlugin extends Plugin {
  settings: JokerTypeSettings = { ...DEFAULT_SETTINGS }
  private audio = new AudioEngine()
  private statusEl: HTMLElement | null = null
  private eventCount = 0
  private spawnCount = 0
  private missedCoordCount = 0
  private audioCount = 0
  private fallbackOverlays = new WeakMap<EditorView, EffectOverlay>()
  private fallbackOverlaySet = new Set<EffectOverlay>()
  private fallbackEditorContents = new WeakMap<Editor, string>()
  private comboCount = 0
  private comboResetTimer: number | null = null

  async onload(): Promise<void> {
    await this.loadSettings()
    this.updateStatus()
    this.addSettingTab(new JokerTypeSettingTab(this.app, this))
    this.addCommand({
      id: 'toggle-effects',
      name: 'Toggle effects',
      callback: () => {
        void this.toggleEnabled()
      }
    })
    this.addCommand({
      id: 'show-diagnostics',
      name: 'Show effect diagnostics',
      callback: () => this.showDiagnostics()
    })
    this.registerEvent(this.app.workspace.on('editor-change', (editor) => this.handleEditorChange(editor)))
    this.app.workspace.updateOptions()
  }

  onunload(): void {
    for (const overlay of this.fallbackOverlaySet) overlay.destroy()
    this.fallbackOverlaySet.clear()
    if (this.comboResetTimer) window.clearTimeout(this.comboResetTimer)
    this.comboResetTimer = null
    this.audio.dispose()
  }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData() as (Partial<JokerTypeSettings> & { markdownMoments?: 'off' | 'essentials' }) | null
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved)
    if (saved && !('markdownMomentDeck' in saved) && saved.markdownMoments === 'essentials') {
      this.settings = applyMarkdownMomentDeck(this.settings, 'essentials')
    }
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

  async toggleEnabled(): Promise<void> {
    this.settings.enabled = !this.settings.enabled
    if (!this.settings.enabled) this.removeStatusItem()
    await this.saveSettings()
    this.refreshExtension()
    new Notice(`JokerType ${this.settings.enabled ? 'enabled' : 'disabled'}.`)
  }

  triggerTestEffect(): void {
    if (!this.settings.enabled) {
      new Notice('JokerType is disabled.')
      return
    }

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
    const momentEvents: TypingEffectEvent[] = MARKDOWN_MOMENTS
      .filter((moment) => this.settings.markdownMomentEnabled[moment])
      .map((moment) => ({ type: 'moment', moment, from: offset, to: offset }))
    const events: TypingEffectEvent[] = [
      { type: 'char', text: 'J', from: offset, to: offset + 1 },
      { type: 'char', text: ' ', from: offset, to: offset + 1 },
      { type: 'enter', from: offset },
      ...momentEvents,
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

  private handleEditorChange(editor: Editor): void {
    window.setTimeout(() => {
      if (!this.settings.enabled) return

      const view = this.editorViewFrom(editor)
      if (!view) return

      const cursor = editor.getCursor()
      const offset = editor.posToOffset(cursor)
      const currentContent = editor.getValue()
      const previousContent = this.fallbackEditorContents.get(editor)
      this.fallbackEditorContents.set(editor, currentContent)

      const events = this.fallbackEventsFor(editor, offset, previousContent, currentContent)
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
    }, 32)
  }

  private fallbackEventsFor(editor: Editor, offset: number, previousContent: string | undefined, currentContent: string): TypingEffectEvent[] {
    if (previousContent === undefined) {
      const from = Math.max(0, offset - 1)
      const inserted = offset > 0 ? editor.getRange(editor.offsetToPos(from), editor.offsetToPos(offset)) : ''
      return classifyTextChange({ from, to: offset, inserted, throttleLargeChanges: this.settings.throttleLargeChanges })
    }

    const previousLength = previousContent.length
    const currentLength = currentContent.length

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
      const events = classifyTextChange({ from, to: offset, inserted, throttleLargeChanges: this.settings.throttleLargeChanges })
      if (Object.values(this.settings.markdownMomentEnabled).some(Boolean)) {
        const moment = detectMarkdownMoment({
          before: previousContent,
          after: currentContent,
          change: { fromA: from, toA: from, fromB: from, toB: offset, inserted },
          throttleLargeChanges: this.settings.throttleLargeChanges
        })
        if (moment && this.settings.markdownMomentEnabled[moment.moment]) events.push(momentEffectEvent(moment))
      }
      return events
    }

    if (currentContent !== previousContent) {
      const change = replacementChange(previousContent, currentContent)
      const events = classifyTextChange({
        from: change.fromA,
        to: change.toA,
        inserted: change.inserted,
        throttleLargeChanges: this.settings.throttleLargeChanges
      })
      if (Object.values(this.settings.markdownMomentEnabled).some(Boolean)) {
        const moment = detectMarkdownMoment({
          before: previousContent,
          after: currentContent,
          change,
          throttleLargeChanges: this.settings.throttleLargeChanges
        })
        if (moment && this.settings.markdownMomentEnabled[moment.moment]) events.push(momentEffectEvent(moment))
      }
      return events
    }

    return []
  }

  private editorViewFrom(editor: Editor): EditorView | null {
    const maybeEditor = editor as unknown as { cm?: EditorView }
    if (maybeEditor.cm) return maybeEditor.cm

    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!markdownView || markdownView.editor !== editor) return null
    const editorEl = markdownView.containerEl.querySelector<HTMLElement>('.cm-editor')
    return editorEl ? EditorView.findFromDOM(editorEl) : null
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
    if (!this.settings.enabled || !this.settings.statusComboEnabled) {
      this.removeStatusItem()
      return
    }

    if (this.comboCount <= 1) {
      this.statusEl?.remove()
      this.statusEl = null
      return
    }

    if (!this.statusEl) this.statusEl = this.addStatusBarItem()
    this.statusEl.setText(`JokerType x${this.comboCount}`)
  }

  private removeStatusItem(): void {
    this.statusEl?.remove()
    this.statusEl = null
    this.comboCount = 0
  }

  private showDiagnostics(): void {
    new Notice(`JokerType: ${this.eventCount} events, ${this.spawnCount} rendered, ${this.missedCoordCount} without coordinates, ${this.audioCount} sounds.`)
  }

  private registerCombo(events: number): void {
    if (!this.settings.statusComboEnabled || events <= 0) return
    this.comboCount += events
    if (this.comboResetTimer) window.clearTimeout(this.comboResetTimer)
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

function replacementChange(before: string, after: string): { fromA: number; toA: number; fromB: number; toB: number; inserted: string } {
  let prefixLength = 0
  const commonLength = Math.min(before.length, after.length)
  while (prefixLength < commonLength && before[prefixLength] === after[prefixLength]) prefixLength += 1

  let suffixLength = 0
  const remainingBefore = before.length - prefixLength
  const remainingAfter = after.length - prefixLength
  while (suffixLength < remainingBefore && suffixLength < remainingAfter
    && before[before.length - 1 - suffixLength] === after[after.length - 1 - suffixLength]) {
    suffixLength += 1
  }

  const toA = before.length - suffixLength
  const toB = after.length - suffixLength
  return { fromA: prefixLength, toA, fromB: prefixLength, toB, inserted: after.slice(prefixLength, toB) }
}
