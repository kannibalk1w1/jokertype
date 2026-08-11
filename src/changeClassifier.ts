export type TypingEffectEvent =
  | { type: 'char'; text: string; from: number; to: number }
  | { type: 'enter'; from: number }
  | { type: 'tab'; from: number }
  | { type: 'delete'; from: number; to: number; direction: 'backward' | 'forward' | 'unknown' }
  | { type: 'chunk'; text: string; from: number; length: number; reason: 'paste' | 'composition' | 'autocomplete' | 'unknown' }

export type InsertionReason = Extract<TypingEffectEvent, { type: 'chunk' }>['reason']

export interface TextChangeInput {
  from: number
  to: number
  inserted: string
  deleteDirection?: 'backward' | 'forward' | 'unknown'
  insertionReason?: InsertionReason
  throttleLargeChanges?: boolean
}

export function classifyTextChange(change: TextChangeInput): TypingEffectEvent[] {
  const { from, to, inserted, deleteDirection = 'unknown', insertionReason = 'unknown' } = change

  if (inserted.length === 0 && to > from) {
    return [{ type: 'delete', from, to, direction: deleteDirection }]
  }

  // Paste is transaction metadata, not a guess based on how much text changed.
  // Check it before the character cases so even a one-character clipboard paste
  // keeps its actual origin.
  if (inserted.length > 0 && insertionReason === 'paste') {
    return [{ type: 'chunk', text: inserted, from, length: inserted.length, reason: 'paste' }]
  }

  if (inserted === '\n') {
    return [{ type: 'enter', from }]
  }

  if (inserted === '\t') {
    return [{ type: 'tab', from }]
  }

  if (isSinglePrintableCharacter(inserted)) {
    return [{ type: 'char', text: inserted, from, to: from + inserted.length }]
  }

  if (inserted.length > 0) {
    // Markdown continuation inserts the newline and syntax such as `> ` or
    // `- ` together. It is still the result of pressing Enter.
    if (inserted.startsWith('\n')) return [{ type: 'enter', from }]

    return [{ type: 'chunk', text: inserted, from, length: inserted.length, reason: insertionReason }]
  }

  return []
}

function isSinglePrintableCharacter(value: string): boolean {
  return [...value].length === 1 && value !== '\n' && value !== '\t'
}
