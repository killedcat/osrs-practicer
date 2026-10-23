import { describe, expect, it } from 'vitest'
import type { RunScore, VerdictEvent } from '../engine'
import { simulate } from '../engine'
import { allDefinitions, validateDefinition } from './index'
import { oneTickChinchompas } from './1t-chinchompas'
import { threeTickFishing } from './3t-fishing'
import { threeTickGranite } from './3t-granite'

const at = (ticks: number[], target: string) => ticks.map((tick) => ({ tick, target }))

describe('allDefinitions validation', () => {
  it('runs every shipped definition through validateDefinition', () => {
    expect(allDefinitions).toHaveLength(3)
    for (const definition of allDefinitions) {
      expect(validateDefinition(definition), `${definition.id} must validate`).toEqual([])
    }
  })
})

describe('replay golden: 1t-chinchompas', () => {
  it('pins ten ticks of perfect throws: one hit every tick', () => {
    const judgement = simulate(
      oneTickChinchompas,
      at([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'trap'),
      10,
    )
    const expectedVerdicts: VerdictEvent[] = [
      { tick: 0, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 1, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 2, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 3, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 4, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 5, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 6, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 7, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 8, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 9, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
    ]
    expect(judgement.verdicts).toEqual(expectedVerdicts)
    expect(judgement.score).toEqual({
      hits: 10,
      wrongTick: 0,
      wrongTarget: 0,
      missed: 0,
      extra: 0,
      wastedTicks: 0,
      longestStreak: 10,
    } satisfies RunScore)
  })

  it('pins a slipped rhythm: a doubled click (wrong-tick), a dead tick (missed), then recovery', () => {
    const judgement = simulate(
      oneTickChinchompas,
      at([0, 1, 2, 3, 4, 4, 6, 7], 'trap'),
      8,
    )
    const expectedVerdicts: VerdictEvent[] = [
      { tick: 0, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 1, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 2, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 3, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 4, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 4, target: 'trap', verdict: 'wrong-tick', expectedTickInCycle: 0 },
      { tick: 5, target: 'trap', verdict: 'missed', expectedTickInCycle: 0 },
      { tick: 6, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 7, target: 'trap', verdict: 'hit', expectedTickInCycle: 0 },
    ]
    expect(judgement.verdicts).toEqual(expectedVerdicts)
    expect(judgement.score).toEqual({
      hits: 7,
      wrongTick: 1,
      wrongTarget: 0,
      missed: 1,
      extra: 0,
      wastedTicks: 0,
      longestStreak: 5,
    } satisfies RunScore)
  })
})

describe('replay golden: 3t-fishing', () => {
  it('pins two clean cycles, a missed spot with three wasted ticks, and an aligned recovery', () => {
    const judgement = simulate(
      threeTickFishing,
      [
        ...at([0, 3, 9], 'spot'),
        ...at([1, 4, 10], 'herb'),
        ...at([2, 5, 11], 'tar'),
      ],
      12,
    )
    const expectedVerdicts: VerdictEvent[] = [
      { tick: 0, target: 'spot', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 1, target: 'herb', verdict: 'hit', expectedTickInCycle: 1 },
      { tick: 2, target: 'tar', verdict: 'hit', expectedTickInCycle: 2 },
      { tick: 3, target: 'spot', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 4, target: 'herb', verdict: 'hit', expectedTickInCycle: 1 },
      { tick: 5, target: 'tar', verdict: 'hit', expectedTickInCycle: 2 },
      { tick: 6, target: 'spot', verdict: 'missed', expectedTickInCycle: 0 },
      { tick: 9, target: 'spot', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 10, target: 'herb', verdict: 'hit', expectedTickInCycle: 1 },
      { tick: 11, target: 'tar', verdict: 'hit', expectedTickInCycle: 2 },
    ]
    expect(judgement.verdicts).toEqual(expectedVerdicts)
    expect(judgement.score).toEqual({
      hits: 9,
      wrongTick: 0,
      wrongTarget: 0,
      missed: 1,
      extra: 0,
      wastedTicks: 3,
      longestStreak: 6,
    } satisfies RunScore)
  })
})

describe('replay golden: 3t-granite', () => {
  it('pins a perfect rock rhythm with granite drops interleaved and invisible to judging', () => {
    const judgement = simulate(
      threeTickGranite,
      [
        ...at([0, 3, 6, 9], 'rock'),
        ...at([0, 1, 2, 4, 5, 6, 7, 8, 10, 11], 'granite'),
      ],
      12,
    )
    const expectedVerdicts: VerdictEvent[] = [
      { tick: 0, target: 'rock', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 3, target: 'rock', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 6, target: 'rock', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 9, target: 'rock', verdict: 'hit', expectedTickInCycle: 0 },
    ]
    expect(judgement.verdicts).toEqual(expectedVerdicts)
    expect(judgement.score).toEqual({
      hits: 4,
      wrongTick: 0,
      wrongTarget: 0,
      missed: 0,
      extra: 0,
      wastedTicks: 0,
      longestStreak: 4,
    } satisfies RunScore)
  })

  it('pins a wrong-target cycle: a guam-like click on the due tick is extra plus a missed rock, then an aligned recovery', () => {
    const judgement = simulate(
      threeTickGranite,
      [
        ...at([0, 6], 'rock'),
        ...at([1, 4], 'granite'),
        { tick: 3, target: 'herb' },
      ],
      7,
    )
    const expectedVerdicts: VerdictEvent[] = [
      { tick: 0, target: 'rock', verdict: 'hit', expectedTickInCycle: 0 },
      { tick: 3, target: 'herb', verdict: 'extra' },
      { tick: 3, target: 'rock', verdict: 'missed', expectedTickInCycle: 0 },
      { tick: 6, target: 'rock', verdict: 'hit', expectedTickInCycle: 0 },
    ]
    expect(judgement.verdicts).toEqual(expectedVerdicts)
    expect(judgement.score).toEqual({
      hits: 2,
      wrongTick: 0,
      wrongTarget: 0,
      missed: 1,
      extra: 1,
      wastedTicks: 3,
      longestStreak: 1,
    } satisfies RunScore)
  })
})
