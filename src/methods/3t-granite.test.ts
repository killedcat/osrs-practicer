import { describe, expect, it } from 'vitest'
import { simulate } from '../engine'
import { allDefinitions, getMethod, validateDefinition } from './index'
import { threeTickGranite } from './3t-granite'

const at = (ticks: number[], target: string) => ticks.map((tick) => ({ tick, target }))

describe('3t-granite definition', () => {
  it('passes validation', () => {
    expect(validateDefinition(threeTickGranite)).toEqual([])
  })

  it('is shipped in allDefinitions and retrievable by id', () => {
    expect(allDefinitions).toContain(threeTickGranite)
    expect(getMethod('3t-granite')).toBe(threeTickGranite)
  })

  it('is an anchored three-tick cycle on the rock with free granite drops', () => {
    expect(threeTickGranite.semantics).toBe('anchored')
    expect(threeTickGranite.cycleLength).toBe(3)
    expect(threeTickGranite.targets).toEqual([
      { id: 'rock', label: 'Granite rock', placement: { region: 'viewport', x: 50, y: 45 } },
      { id: 'granite', label: 'Granite', placement: { region: 'inventory' } },
    ])
    expect(threeTickGranite.expectedInputs).toEqual([
      { tickInCycle: 0, target: 'rock', primary: true },
    ])
  })

  it('judges a perfect five-cycle log as five hits with drops invisible to judging', () => {
    const judgement = simulate(
      threeTickGranite,
      [...at([0, 3, 6, 9, 12], 'rock'), ...at([1, 4, 13], 'granite')],
      15,
    )
    expect(judgement.score.hits).toBe(5)
    expect(judgement.score.missed).toBe(0)
    expect(judgement.score.wrongTick).toBe(0)
    expect(judgement.score.wrongTarget).toBe(0)
    expect(judgement.score.extra).toBe(0)
    expect(judgement.score.wastedTicks).toBe(0)
    expect(judgement.score.longestStreak).toBe(5)
    expect(judgement.verdicts).toHaveLength(5)
    expect(judgement.verdicts.every((event) => event.target === 'rock')).toBe(true)
    expect(judgement.verdicts.filter((event) => [1, 4, 13].includes(event.tick))).toHaveLength(0)
  })

  it('charges wasted ticks on a missed rock and recovers cleanly on the next anchor', () => {
    const judgement = simulate(
      threeTickGranite,
      [...at([0, 4, 7, 10], 'rock'), ...at([1, 8], 'granite')],
      11,
    )
    expect(judgement.score.wastedTicks).toBeGreaterThan(0)
    expect(judgement.score.missed).toBe(1)
    expect(judgement.score.hits).toBe(3)
    const recovery = judgement.verdicts.filter(
      (event) => event.tick >= 4 && event.target === 'rock',
    )
    expect(recovery.map((event) => event.verdict)).toEqual(['wrong-tick', 'hit', 'hit'])
  })
})
