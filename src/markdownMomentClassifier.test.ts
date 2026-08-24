import { describe, expect, it } from 'vitest'
import { detectMarkdownMoment } from './markdownMomentClassifier'

describe('detectMarkdownMoment', () => {
  it('does not repeat a heading Moment when the heading is left', () => {
    expect(detectMarkdownMoment({
      before: '# A title',
      after: '# A title\n',
      change: { fromA: 9, toA: 9, fromB: 9, toB: 10, inserted: '\n' }
    })).toBeNull()
  })

  it('recognizes a heading when its first text character is added', () => {
    expect(detectMarkdownMoment({
      before: '# ',
      after: '# H',
      change: { fromA: 2, toA: 2, fromB: 2, toB: 3, inserted: 'H' }
    })).toMatchObject({ type: 'moment', moment: 'title' })
  })

  it('recognizes a completed wiki link', () => {
    expect(detectMarkdownMoment({
      before: 'See [[JokerType]',
      after: 'See [[JokerType]]',
      change: { fromA: 16, toA: 16, fromB: 16, toB: 17, inserted: ']' }
    })).toEqual({ type: 'moment', moment: 'linked', from: 16, to: 17 })
  })

  it('recognizes a completed wiki link when autocomplete moves the cursor', () => {
    expect(detectMarkdownMoment({
      before: 'See [[Joker',
      after: 'See [[JokerType]] more',
      change: { fromA: 11, toA: 11, fromB: 11, toB: 20, inserted: 'Type]]' }
    })).toMatchObject({ type: 'moment', moment: 'linked' })
  })

  it('distinguishes an embedded note from a wiki link', () => {
    expect(detectMarkdownMoment({
      before: '![[JokerType]',
      after: '![[JokerType]]',
      change: { fromA: 13, toA: 13, fromB: 13, toB: 14, inserted: ']' }
    })).toMatchObject({ type: 'moment', moment: 'embedded' })
  })

  it('recognizes a new task marker without triggering on its text', () => {
    expect(detectMarkdownMoment({
      before: '- [ ',
      after: '- [ ]',
      change: { fromA: 4, toA: 4, fromB: 4, toB: 5, inserted: ']' }
    })).toEqual({ type: 'moment', moment: 'quest', from: 4, to: 5 })
  })

  it('recognizes an unchecked task becoming complete', () => {
    expect(detectMarkdownMoment({
      before: '- [ ] ship it',
      after: '- [x] ship it',
      change: { fromA: 3, toA: 4, fromB: 3, toB: 4, inserted: 'x' }
    })).toEqual({ type: 'moment', moment: 'cleared', from: 2, to: 5 })
  })

  it('does not award moments for pasted text', () => {
    expect(detectMarkdownMoment({
      before: '',
      after: '- [ ]',
      change: { fromA: 0, toA: 0, fromB: 0, toB: 5, inserted: '- [ ]', isPaste: true }
    })).toBeNull()
  })

  it('recognizes a completed callout and footnote', () => {
    expect(detectMarkdownMoment({
      before: '> [!tip',
      after: '> [!tip]',
      change: { fromA: 7, toA: 7, fromB: 7, toB: 8, inserted: ']' }
    })).toMatchObject({ type: 'moment', moment: 'summoned' })
    expect(detectMarkdownMoment({
      before: '> [!tip',
      after: '> [!tip] A title',
      change: { fromA: 7, toA: 7, fromB: 7, toB: 16, inserted: '] A title' }
    })).toMatchObject({ type: 'moment', moment: 'summoned' })
    expect(detectMarkdownMoment({
      before: 'Read [^source',
      after: 'Read [^source]',
      change: { fromA: 13, toA: 13, fromB: 13, toB: 14, inserted: ']' }
    })).toMatchObject({ type: 'moment', moment: 'cited' })
  })

  it('recognizes closing a code block, frontmatter, and table header', () => {
    expect(detectMarkdownMoment({
      before: '```\ncode\n```',
      after: '```\ncode\n```\n',
      change: { fromA: 12, toA: 12, fromB: 12, toB: 13, inserted: '\n' }
    })).toMatchObject({ type: 'moment', moment: 'locked-in' })
    expect(detectMarkdownMoment({
      before: '---\ntitle: JokerType\n---',
      after: '---\ntitle: JokerType\n---\n',
      change: { fromA: 24, toA: 24, fromB: 24, toB: 25, inserted: '\n' }
    })).toMatchObject({ type: 'moment', moment: 'dealt' })
    expect(detectMarkdownMoment({
      before: 'Name | Score\n| --- | --- |',
      after: 'Name | Score\n| --- | --- |\n',
      change: { fromA: 26, toA: 26, fromB: 26, toB: 27, inserted: '\n' }
    })).toMatchObject({ type: 'moment', moment: 'grid' })
  })

  it('does not award Moments inside a fenced code block', () => {
    expect(detectMarkdownMoment({
      before: '```\n- [ ',
      after: '```\n- [ ]',
      change: { fromA: 8, toA: 8, fromB: 8, toB: 9, inserted: ']' }
    })).toBeNull()
  })
})
