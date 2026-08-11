import { EditorState } from '@codemirror/state'
import type { ViewUpdate } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { eventsFromUpdate, PasteTracker } from './typingEffectExtension'

function updateWithInsertion(inserted: string, userEvent: string): ViewUpdate {
  const state = EditorState.create({ doc: '> quoted' })
  const transaction = state.update({
    changes: { from: state.doc.length, insert: inserted },
    userEvent
  })

  return { transactions: [transaction] } as unknown as ViewUpdate
}

describe('eventsFromUpdate', () => {
  it('treats Markdown blockquote continuation as Enter', () => {
    const update = updateWithInsertion('\n> ', 'input.type')

    expect(eventsFromUpdate(update)).toEqual([
      { type: 'enter', from: 8 }
    ])
  })

  it('uses the CodeMirror paste annotation for clipboard paste', () => {
    const update = updateWithInsertion('clipboard text', 'input.paste')

    expect(eventsFromUpdate(update)).toEqual([
      { type: 'chunk', text: 'clipboard text', from: 8, length: 14, reason: 'paste' }
    ])
  })

  it('uses an observed DOM paste when Obsidian replaces the transaction annotation', () => {
    const update = updateWithInsertion('clipboard text', 'input.type')

    expect(eventsFromUpdate(update, { throttleLargeChanges: true }, true)).toEqual([
      { type: 'chunk', text: 'clipboard text', from: 8, length: 14, reason: 'paste' }
    ])
  })

  it('does not treat a large typed transaction as paste', () => {
    const update = updateWithInsertion('generated text', 'input.type')

    expect(eventsFromUpdate(update, { throttleLargeChanges: true })).toEqual([
      { type: 'chunk', text: 'generated text', from: 8, length: 14, reason: 'unknown' }
    ])
  })
})

describe('PasteTracker', () => {
  it('shares one observed paste with the first change pipeline that consumes it', () => {
    const tracker = new PasteTracker()

    tracker.observe()

    expect(tracker.consume()).toBe(true)
    expect(tracker.consume()).toBe(false)
  })

  it('expires a paste signal that produced no document change', () => {
    vi.useFakeTimers()
    const tracker = new PasteTracker()

    tracker.observe()
    vi.advanceTimersByTime(1000)

    expect(tracker.consume()).toBe(false)
    vi.useRealTimers()
  })
})
