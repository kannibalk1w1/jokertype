export type MarkdownMoment = 'title' | 'linked' | 'embedded' | 'quest' | 'cleared' | 'summoned' | 'locked-in' | 'cited' | 'dealt' | 'grid'

export interface MarkdownMomentChange {
  fromA: number
  toA: number
  fromB: number
  toB: number
  inserted: string
  isPaste?: boolean
}

export interface MarkdownMomentInput {
  before: string
  after: string
  change: MarkdownMomentChange
  throttleLargeChanges?: boolean
}

export interface MarkdownMomentEvent {
  type: 'moment'
  moment: MarkdownMoment
  from: number
  to: number
}

export function detectMarkdownMoment(input: MarkdownMomentInput): MarkdownMomentEvent | null {
  const { before, after, change, throttleLargeChanges = false } = input
  if (change.isPaste || (throttleLargeChanges && [...change.inserted].length > 12)) return null

  const nextLine = lineAt(after, Math.max(change.fromB, change.toB - 1))
  const previousLine = lineAt(before, change.fromA)
  const beforeCursor = previousLine.text.slice(0, Math.max(0, change.fromA - previousLine.start))
  const afterCursor = nextLine.text.slice(0, Math.max(0, change.toB - nextLine.start))
  if (change.inserted === '\n' && isFenceLine(nextLine.text) && isInsideFencedCodeBlock(after, nextLine.start)) {
    return { type: 'moment', moment: 'locked-in', from: nextLine.start, to: nextLine.start + nextLine.text.length }
  }
  if (isInsideFencedCodeBlock(after, nextLine.start)) return null

  if (change.inserted !== '\n' && /^ {0,3}#{1,6}\s+\S/.test(afterCursor) && !/^ {0,3}#{1,6}\s+\S/.test(beforeCursor)) {
    return { type: 'moment', moment: 'title', from: change.fromB, to: change.toB }
  }

  const embedded = lastMatch(nextLine.text, /!\[\[[^\]\n]+(?:\|[^\]\n]+)?\]\]/g)
  if (embedded && !previousLine.text.includes(embedded)) {
    return { type: 'moment', moment: 'embedded', from: Math.max(change.fromB, change.toB - 1), to: change.toB }
  }
  const linked = lastMatch(nextLine.text, /\[\[[^\]\n]+(?:\|[^\]\n]+)?\]\]/g)
  if (linked && !previousLine.text.includes(linked)) {
    return { type: 'moment', moment: 'linked', from: Math.max(change.fromB, change.toB - 1), to: change.toB }
  }
  const callout = nextLine.text.match(/^ {0,3}> {0,3}\[![\w-]+\](?:\s|$)/)?.[0]
  if (callout && !previousLine.text.includes(callout.trim())) {
    return { type: 'moment', moment: 'summoned', from: Math.max(change.fromB, change.toB - 1), to: change.toB }
  }
  const citation = lastMatch(nextLine.text, /\[\^[^\]\n]+\]/g)
  if (citation && !previousLine.text.includes(citation)) {
    return { type: 'moment', moment: 'cited', from: Math.max(change.fromB, change.toB - 1), to: change.toB }
  }
  const newTask = nextLine.text.match(/^\s*(?:[-+*]|\d+[.)])\s+\[ \](?:\s|$)/)?.[0]
  if (newTask && !previousLine.text.includes(newTask.trim())) {
    return { type: 'moment', moment: 'quest', from: Math.max(change.fromB, change.toB - 1), to: change.toB }
  }

  if (change.inserted === '\n') {
    const completedLine = lineAt(after, Math.max(0, change.fromB - 1))
    if (isClosingFrontmatter(after, completedLine)) {
      return { type: 'moment', moment: 'dealt', from: completedLine.start, to: completedLine.start + completedLine.text.length }
    }
    if (isTableDivider(completedLine.text) && isTableHeader(lineBefore(after, completedLine.start))) {
      return { type: 'moment', moment: 'grid', from: completedLine.start, to: completedLine.start + completedLine.text.length }
    }
    if (/^ {0,3}#{1,6}\s+\S/.test(completedLine.text) && !/^ {0,3}#{1,6}\s+\S/.test(beforeCursor)) {
      return { type: 'moment', moment: 'title', from: change.fromB, to: change.toB }
    }
  }

  if (/[xX]/.test(change.inserted)) {
    const checkedTask = nextLine.text.match(/^\s*(?:[-+*]|\d+[.)])\s+\[[xX]\]/)
    const checkedAt = checkedTask ? checkedTask[0].lastIndexOf('[') : -1
    const uncheckedBefore = /^\s*(?:[-+*]|\d+[.)])\s+\[ \]/.test(previousLine.text)
    const changedAt = change.fromB - nextLine.start
    if (uncheckedBefore && checkedAt >= 0 && changedAt >= checkedAt && changedAt <= checkedAt + 4) {
      return { type: 'moment', moment: 'cleared', from: nextLine.start + checkedAt, to: nextLine.start + checkedAt + 3 }
    }
  }

  return null
}

function lineAt(text: string, position: number): { start: number; text: string } {
  const safePosition = Math.max(0, Math.min(text.length, position))
  const start = text.lastIndexOf('\n', Math.max(0, safePosition - 1)) + 1
  const end = text.indexOf('\n', safePosition)
  return { start, text: text.slice(start, end === -1 ? text.length : end) }
}

function lineBefore(text: string, lineStart: number): { start: number; text: string } {
  if (lineStart <= 0) return { start: 0, text: '' }
  return lineAt(text, lineStart - 1)
}

function isInsideFencedCodeBlock(text: string, lineStart: number): boolean {
  const fences = text.slice(0, lineStart).match(/^ {0,3}(?:```|~~~)/gm)
  return (fences?.length ?? 0) % 2 === 1
}

function isFenceLine(line: string): boolean {
  return /^ {0,3}(?:```+|~~~+)\s*$/.test(line)
}

function isClosingFrontmatter(text: string, line: { start: number; text: string }): boolean {
  return line.start > 0 && /^---\s*$/.test(line.text) && text.startsWith('---\n')
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line)
}

function isTableHeader(line: { text: string }): boolean {
  return line.text.includes('|') && line.text.trim().length > 0
}

function lastMatch(text: string, pattern: RegExp): string | null {
  const matches = [...text.matchAll(pattern)]
  return matches.length > 0 ? matches[matches.length - 1][0] : null
}
