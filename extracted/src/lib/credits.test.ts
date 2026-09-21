import { describe, expect, it } from 'vitest'
import { calcDefaultCredits } from './credits'

describe('calcDefaultCredits', () => {
  it('returns 40% of headcount, floored', () => {
    expect(calcDefaultCredits(10)).toBe(4)
    expect(calcDefaultCredits(8)).toBe(3)
    expect(calcDefaultCredits(5)).toBe(2)
  })

  it('returns 0 for an empty team', () => {
    expect(calcDefaultCredits(0)).toBe(0)
  })
})
