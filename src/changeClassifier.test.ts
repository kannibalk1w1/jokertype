import { describe, expect, it } from 'vitest'
import { classifyTextChange } from './changeClassifier'

describe('classifyTextChange', () => {
  it('classifies a single printable character', () => {
    expect(classifyTextChange({ from: 4, to: 4, inserted: 'a' })).toEqual([
      { type: 'char', text: 'a', from: 4, to: 5 }
    ])
  })

  it('classifies enter', () => {
    expect(classifyTextChange({ from: 10, to: 10, inserted: '\n' })).toEqual([
      { type: 'enter', from: 10 }
    ])
  })

  it('classifies tab', () => {
    expect(classifyTextChange({ from: 2, to: 2, inserted: '\t' })).toEqual([
      { type: 'tab', from: 2 }
    ])
  })

  it('classifies deletion', () => {
    expect(classifyTextChange({ from: 5, to: 8, inserted: '' })).toEqual([
      { type: 'delete', from: 5, to: 8, direction: 'unknown' }
    ])
  })

  it('keeps deletion direction when provided', () => {
    expect(classifyTextChange({ from: 5, to: 8, inserted: '', deleteDirection: 'backward' })).toEqual([
      { type: 'delete', from: 5, to: 8, direction: 'backward' }
    ])
  })

  it('coalesces multi-character insertion into a chunk', () => {
    expect(classifyTextChange({ from: 1, to: 1, inserted: 'joker' })).toEqual([
      { type: 'chunk', text: 'joker', from: 1, length: 5, reason: 'unknown' }
    ])
  })

  it('coalesces mixed newline chunks', () => {
    expect(classifyTextChange({ from: 1, to: 1, inserted: 'a\nb' })).toEqual([
      { type: 'chunk', text: 'a\nb', from: 1, length: 3, reason: 'unknown' }
    ])
  })

  it('marks large throttled insertions as paste', () => {
    expect(classifyTextChange({ from: 1, to: 1, inserted: 'a long pasted string', throttleLargeChanges: true })).toEqual([
      { type: 'chunk', text: 'a long pasted string', from: 1, length: 20, reason: 'paste' }
    ])
  })
})
