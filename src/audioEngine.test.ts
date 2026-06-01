import { describe, expect, it } from 'vitest'
import { PitchStreak } from './audioEngine'

describe('PitchStreak', () => {
  it('starts near base pitch and rises with rapid hits', () => {
    const streak = new PitchStreak()
    expect(streak.nextPitch()).toBeCloseTo(1.01)
    expect(streak.nextPitch()).toBeCloseTo(1.02)
    expect(streak.nextPitch()).toBeCloseTo(1.03)
  })

  it('caps pitch at 1.3', () => {
    const streak = new PitchStreak()
    let pitch = 1
    for (let i = 0; i < 100; i += 1) pitch = streak.nextPitch()
    expect(pitch).toBe(1.3)
  })

  it('can be reset', () => {
    const streak = new PitchStreak()
    streak.nextPitch()
    streak.nextPitch()
    streak.reset()
    expect(streak.nextPitch()).toBeCloseTo(1.01)
  })
})
