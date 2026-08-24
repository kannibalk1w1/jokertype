import { ViewPlugin, type ViewUpdate, type EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { classifyTextChange, momentEffectEvent, type TypingEffectEvent } from './changeClassifier'
import { detectMarkdownMoment } from './markdownMomentClassifier'
import { AudioEngine } from './audioEngine'
import { EffectOverlay } from './effectOverlay'
import type { JokerTypeSettings } from './settings'
import { DEFAULT_SETTINGS } from './settingsModel'

export interface TypingEffectExtensionOptions {
  getSettings: () => JokerTypeSettings
  audio: AudioEngine
  onEvents?: (stats: { events: number; spawned: number; missedCoords: number; audio: number }) => void
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
    if (!settings.enabled) return

    const events = eventsFromUpdate(update, settings)
    let audio = 0

    for (const event of events) {
      if (this.options.audio.play(event, settings)) audio += 1
    }

    if (events.length === 0) return

    window.requestAnimationFrame(() => {
      let spawned = 0
      let missedCoords = 0
      for (const event of events) {
        if (this.overlay.spawn(event, settings)) spawned += 1
        else missedCoords += 1
      }
      this.options.onEvents?.({ events: events.length, spawned, missedCoords, audio })
    })
  }

  destroy(): void {
    this.overlay.destroy()
  }
}

export function eventsFromUpdate(update: ViewUpdate, settings: Pick<JokerTypeSettings, 'throttleLargeChanges' | 'markdownMomentEnabled'> = { throttleLargeChanges: false, markdownMomentEnabled: DEFAULT_SETTINGS.markdownMomentEnabled }): TypingEffectEvent[] {
  const events: TypingEffectEvent[] = []

  for (const transaction of update.transactions) {
    if (!transaction.docChanged) continue

    transaction.changes.iterChanges((fromA, toA, fromB, _toB, inserted) => {
      const insertedText = inserted.toString()
      const from = insertedText.length > 0 ? fromB : fromA
      const to = insertedText.length > 0 ? fromB : toA
      const deleteDirection = transaction.isUserEvent('delete.backward')
        ? 'backward'
        : transaction.isUserEvent('delete.forward')
          ? 'forward'
          : 'unknown'
      events.push(...classifyTextChange({
        from,
        to,
        inserted: insertedText,
        deleteDirection,
        throttleLargeChanges: settings.throttleLargeChanges
      }))
      if (Object.values(settings.markdownMomentEnabled).some(Boolean)) {
        const moment = detectMarkdownMoment({
          before: transaction.startState.doc.toString(),
          after: transaction.newDoc.toString(),
          change: {
            fromA,
            toA,
            fromB,
            toB: _toB,
            inserted: insertedText,
            isPaste: transaction.isUserEvent('input.paste')
          },
          throttleLargeChanges: settings.throttleLargeChanges
        })
        if (moment && settings.markdownMomentEnabled[moment.moment]) events.push(momentEffectEvent(moment))
      }
    })
  }

  return events
}
