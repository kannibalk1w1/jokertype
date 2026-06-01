import { ViewPlugin, type ViewUpdate, type EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { classifyTextChange, type TypingEffectEvent } from './changeClassifier'
import { AudioEngine } from './audioEngine'
import { EffectOverlay } from './effectOverlay'
import type { JokerTypeSettings } from './settings'

export interface TypingEffectExtensionOptions {
  getSettings: () => JokerTypeSettings
  audio: AudioEngine
}

export function createTypingEffectExtension(options: TypingEffectExtensionOptions): Extension {
  return ViewPlugin.define((view) => new TypingEffectPlugin(view, options))
}

class TypingEffectPlugin {
  private overlay: EffectOverlay

  constructor(private view: EditorView, private options: TypingEffectExtensionOptions) {
    this.overlay = new EffectOverlay(view)
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return

    const settings = this.options.getSettings()
    const events = eventsFromUpdate(update)

    for (const event of events) {
      this.overlay.spawn(event, settings)
      this.options.audio.play(event, settings)
    }
  }

  destroy(): void {
    this.overlay.destroy()
  }
}

export function eventsFromUpdate(update: ViewUpdate): TypingEffectEvent[] {
  const events: TypingEffectEvent[] = []

  for (const transaction of update.transactions) {
    if (!transaction.docChanged) continue

    transaction.changes.iterChanges((fromA, toA, fromB, _toB, inserted) => {
      const insertedText = inserted.toString()
      const from = insertedText.length > 0 ? fromB : fromA
      const to = insertedText.length > 0 ? fromB : toA
      events.push(...classifyTextChange({ from, to, inserted: insertedText }))
    })
  }

  return events
}
