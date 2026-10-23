import { describe, expect, it } from 'vitest'
import { simulate } from '../engine'
import { allDefinitions, getMethod, validateDefinition } from './index'
import { threeTickFishing } from './3t-fishing'

const at = (ticks: number[], target: string) => ticks.map((tick) => ({ tick, target }))

describe('3t-fishing definition', () => {
  it('passes validation', () => {
    expect(validateDefinition(threeTickFishing)).toEqual([])
  })

  it('is shipped in allDefinitions and retrievable by id', () => {
    expect(allDefinitions).toContain(threeTickFishing)
    expect(getMethod('3t-fishing')).toBe(threeTickFishing)
  })

  it('is an anchored three-tick cycle on the spot with herb and tar fillers', () => {
    expect(threeTickFishing.semantics).toBe('anchored')
    expect(threeTickFishing.cycleLength).toBe(3)
    expect(threeTickFishing.targets).toEqual([
      { id: 'spot', label: 'Fishing spot' },
      { id: 'herb', label: 'Clean guam' },
      { id: 'tar', label: 'Swamp tar' },
      { id: 'fish', label: 'Fish', inventory: true },
    ])
    expect(threeTickFishing.expectedInputs).toEqual([
      { tickInCycle: 0, target: 'spot', primary: true },
      { tickInCycle: 1, target: 'herb' },
      { tickInCycle: 2, target: 'tar' },
    ])
  })

  it('judges a perfect five-cycle log as fifteen hits with no misses', () => {
    const judgement = simulate(
      threeTickFishing,
      [
        ...at([0, 3, 6, 9, 12], 'spot'),
        ...at([1, 4, 7, 10, 13], 'herb'),
        ...at([2, 5, 8, 11, 14], 'tar'),
      ],
      15,
    )
    expect(judgement.score.hits).toBe(15)
    expect(judgement.score.missed).toBe(0)
    expect(judgement.score.wrongTick).toBe(0)
    expect(judgement.score.wrongTarget).toBe(0)
    expect(judgement.score.extra).toBe(0)
    expect(judgement.score.wastedTicks).toBe(0)
    expect(judgement.score.longestStreak).toBe(15)
  })

  it('charges wasted ticks on a missed spot and recovers cleanly on the next anchor', () => {
    const judgement = simulate(
      threeTickFishing,
      [
        ...at([0], 'spot'),
        ...at([1], 'herb'),
        ...at([2], 'tar'),
        ...at([4], 'spot'),
        ...at([5], 'herb'),
        ...at([6], 'tar'),
        ...at([7], 'spot'),
        ...at([8], 'herb'),
      ],
      9,
    )
    expect(judgement.score.wastedTicks).toBeGreaterThan(0)
    expect(judgement.score.missed).toBe(1)
    expect(judgement.score.hits).toBe(7)
    const recovery = judgement.verdicts.filter((event) => event.tick >= 5)
    expect(recovery.map((event) => event.verdict)).toEqual(['hit', 'hit', 'hit', 'hit'])
  })
})
