import { ViewPlugin, type ViewUpdate, type EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { classifyTextChange, type InsertionReason, type TypingEffectEvent } from './changeClassifier'
import { AudioEngine } from './audioEngine'
import { EffectOverlay } from './effectOverlay'
import type { JokerTypeSettings } from './settings'

export interface TypingEffectExtensionOptions {
  getSettings: () => JokerTypeSettings
  audio: AudioEngine
  pasteTracker: PasteTracker
  onEvents?: (stats: { events: number; spawned: number; missedCoords: number; audio: number }) => void
}

export class PasteTracker {
  private pending = false
  private resetTimer: ReturnType<typeof setTimeout> | null = null

  observe(): void {
    this.pending = true
    if (this.resetTimer !== null) clearTimeout(this.resetTimer)
    this.resetTimer = setTimeout(() => {
      this.pending = false
      this.resetTimer = null
    }, 1000)
  }

  consume(): boolean {
    if (!this.pending) return false
    this.pending = false
    if (this.resetTimer !== null) clearTimeout(this.resetTimer)
    this.resetTimer = null
    return true
  }

  dispose(): void {
    if (this.resetTimer !== null) clearTimeout(this.resetTimer)
    this.resetTimer = null
    this.pending = false
  }
}

export function createTypingEffectExtension(options: TypingEffectExtensionOptions): Extension {
  return ViewPlugin.define((view) => new TypingEffectPlugin(view, options), {
    eventObservers: {
      paste(this: TypingEffectPlugin): void {
        this.observePaste()
      }
    }
  })
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

    const events = eventsFromUpdate(update, settings, this.options.pasteTracker.consume())
    let spawned = 0
    let missedCoords = 0
    let audio = 0

    for (const event of events) {
      if (this.overlay.spawn(event, settings)) spawned += 1
      else missedCoords += 1
      if (this.options.audio.play(event, settings)) audio += 1
    }

    if (events.length > 0) this.options.onEvents?.({ events: events.length, spawned, missedCoords, audio })
  }

  destroy(): void {
    this.overlay.destroy()
  }

  observePaste(): void {
    this.options.pasteTracker.observe()
  }
}

export function eventsFromUpdate(
  update: ViewUpdate,
  settings: Pick<JokerTypeSettings, 'throttleLargeChanges'> = { throttleLargeChanges: false },
  pasteObserved = false
): TypingEffectEvent[] {
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
        insertionReason: insertionReasonFor(transaction, pasteObserved),
        throttleLargeChanges: settings.throttleLargeChanges
      }))
    })
  }

  return events
}

function insertionReasonFor(transaction: ViewUpdate['transactions'][number], pasteObserved: boolean): InsertionReason {
  if (pasteObserved) return 'paste'
  if (transaction.isUserEvent('input.paste')) return 'paste'
  if (transaction.isUserEvent('input.type.compose')) return 'composition'
  if (transaction.isUserEvent('input.complete')) return 'autocomplete'
  return 'unknown'
}
