export type TypingEffectEvent =
  | { type: 'char'; text: string; from: number; to: number }
  | { type: 'enter'; from: number }
  | { type: 'tab'; from: number }
  | { type: 'delete'; from: number; to: number; direction: 'backward' | 'forward' | 'unknown' }
  | { type: 'chunk'; text: string; from: number; length: number; reason: 'paste' | 'composition' | 'autocomplete' | 'unknown' }

export interface TextChangeInput {
  from: number
  to: number
  inserted: string
}

export function classifyTextChange(change: TextChangeInput): TypingEffectEvent[] {
  const { from, to, inserted } = change

  if (inserted.length === 0 && to > from) {
    return [{ type: 'delete', from, to, direction: 'unknown' }]
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
    return [{ type: 'chunk', text: inserted, from, length: inserted.length, reason: 'unknown' }]
  }

  return []
}

function isSinglePrintableCharacter(value: string): boolean {
  return [...value].length === 1 && value !== '\n' && value !== '\t'
}
