import { describe, expect, it } from 'vitest'
import { colorFor } from './effectOverlay'

describe('Prism theme colors', () => {
  it('uses stable jewel colors for the same typed glyph', () => {
    expect(colorFor({ type: 'char', text: 'a', from: 0, to: 1 }, 'A', 'prism'))
      .toBe(colorFor({ type: 'char', text: 'a', from: 0, to: 1 }, 'A', 'prism'))
  })

  it('keeps special actions legible with dedicated colors', () => {
    expect(colorFor({ type: 'enter', from: 0 }, 'ENTER', 'prism')).toBe('#65e7ff')
    expect(colorFor({ type: 'delete', from: 0, to: 1, direction: 'backward' }, 'BACKSPACE', 'prism')).toBe('#ff5d8f')
  })
})
