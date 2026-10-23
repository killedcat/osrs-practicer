import { describe, expect, it } from 'vitest'
import { judgeRun } from './judge'
import type { MethodDefinition, RunLog, RunScore, Verdict, VerdictEvent } from './types'

const chinMethod: MethodDefinition = {
  id: 'chin-1t',
  name: '1t chins',
  description: 'Throw a red chinchompa every tick.',
  cycleLength: 1,
  semantics: 'metronomic',
  targets: [
    { id: 'chin', label: 'Red chinchompa' },
    { id: 'net', label: 'Small fishing net' },
  ],
  expectedInputs: [{ tickInCycle: 0, target: 'chin' }],
}

const fishingMethod: MethodDefinition = {
  id: 'fishing-3t',
  name: '3t fishing',
  description: 'Move between spots, drink herb tar, protect with tar.',
  cycleLength: 3,
  semantics: 'anchored',
  targets: [
    { id: 'spot', label: 'Fishing spot' },
    { id: 'herb', label: 'Guam tar' },
    { id: 'tar', label: 'Swamp tar' },
    { id: 'net', label: 'Small fishing net' },
  ],
  expectedInputs: [
    { tickInCycle: 0, target: 'spot', primary: true },
    { tickInCycle: 1, target: 'herb' },
    { tickInCycle: 2, target: 'tar' },
  ],
}

interface JudgedCase {
  name: string
  inputs: Array<[number, string]>
  duration: number
  verdicts: VerdictEvent[]
  score: RunScore
}

const v = (tick: number, target: string, verdict: Verdict, exp?: number): VerdictEvent =>
  exp === undefined ? { tick, target, verdict } : { tick, target, verdict, expectedTickInCycle: exp }

const zeroScore: RunScore = {
  hits: 0,
  wrongTick: 0,
  wrongTarget: 0,
  missed: 0,
  extra: 0,
  wastedTicks: 0,
  longestStreak: 0,
}

const score = (over: Partial<RunScore>): RunScore => ({ ...zeroScore, ...over })

const run = (
  definition: MethodDefinition,
  inputs: Array<[number, string]>,
  durationTicks: number,
): RunLog => ({
  definitionId: definition.id,
  inputs: inputs.map(([tick, target]) => ({ tick, target, timestamp: tick * 600 })),
  durationTicks,
})

describe('judgeRun metronomic (1t chins)', () => {
  it.each<JudgedCase>([
    {
      name: 'a throw on every tick is a hit streak',
      inputs: [
        [0, 'chin'],
        [1, 'chin'],
        [2, 'chin'],
        [3, 'chin'],
      ],
      duration: 4,
      verdicts: [v(0, 'chin', 'hit', 0), v(1, 'chin', 'hit', 0), v(2, 'chin', 'hit', 0), v(3, 'chin', 'hit', 0)],
      score: score({ hits: 4, longestStreak: 4 }),
    },
    {
      name: 'an input of the wrong target while the tick throw is open is wrong-target',
      inputs: [[0, 'net']],
      duration: 1,
      verdicts: [v(0, 'net', 'wrong-target', 0), v(0, 'chin', 'missed', 0)],
      score: score({ wrongTarget: 1, missed: 1 }),
    },
    {
      name: 'double-pressing the throw in one tick is wrong-tick on the repeat',
      inputs: [
        [0, 'chin'],
        [0, 'chin'],
      ],
      duration: 1,
      verdicts: [v(0, 'chin', 'hit', 0), v(0, 'chin', 'wrong-tick', 0)],
      score: score({ hits: 1, wrongTick: 1, longestStreak: 1 }),
    },
    {
      name: 'an input past the consumed throw is extra',
      inputs: [
        [0, 'chin'],
        [0, 'net'],
      ],
      duration: 1,
      verdicts: [v(0, 'chin', 'hit', 0), v(0, 'net', 'extra')],
      score: score({ hits: 1, extra: 1, longestStreak: 1 }),
    },
    {
      name: 'ticks without inputs are missed',
      inputs: [[0, 'chin']],
      duration: 3,
      verdicts: [v(0, 'chin', 'hit', 0), v(1, 'chin', 'missed', 0), v(2, 'chin', 'missed', 0)],
      score: score({ hits: 1, missed: 2, longestStreak: 1 }),
    },
    {
      name: 'an empty log misses every expected tick',
      inputs: [],
      duration: 2,
      verdicts: [v(0, 'chin', 'missed', 0), v(1, 'chin', 'missed', 0)],
      score: score({ missed: 2 }),
    },
  ])('$name', ({ inputs, duration, verdicts, score: expectedScore }) => {
    const judgement = judgeRun(run(chinMethod, inputs, duration), chinMethod)
    expect(judgement.verdicts).toEqual(verdicts)
    expect(judgement.score).toEqual(expectedScore)
  })
})

describe('judgeRun anchored (3t fishing)', () => {
  it.each<JudgedCase>([
    {
      name: 'the first primary hit establishes the anchor and opens the cycle',
      inputs: [[2, 'spot']],
      duration: 4,
      verdicts: [v(2, 'spot', 'hit', 0), v(3, 'herb', 'missed', 1)],
      score: score({ hits: 1, missed: 1, longestStreak: 1 }),
    },
    {
      name: 'fillers hit at their offsets and the next primary re-anchors a clean cycle',
      inputs: [
        [0, 'spot'],
        [1, 'herb'],
        [2, 'tar'],
        [3, 'spot'],
        [4, 'herb'],
      ],
      duration: 5,
      verdicts: [
        v(0, 'spot', 'hit', 0),
        v(1, 'herb', 'hit', 1),
        v(2, 'tar', 'hit', 2),
        v(3, 'spot', 'hit', 0),
        v(4, 'herb', 'hit', 1),
      ],
      score: score({ hits: 5, longestStreak: 5 }),
    },
    {
      name: 'a skipped filler is missed once without cascading',
      inputs: [
        [0, 'spot'],
        [2, 'tar'],
        [3, 'spot'],
      ],
      duration: 4,
      verdicts: [v(0, 'spot', 'hit', 0), v(1, 'herb', 'missed', 1), v(2, 'tar', 'hit', 2), v(3, 'spot', 'hit', 0)],
      score: score({ hits: 3, missed: 1, longestStreak: 2 }),
    },
    {
      name: 'a missed primary at the deadline costs capped wasted ticks until re-anchor',
      inputs: [
        [0, 'spot'],
        [6, 'spot'],
      ],
      duration: 7,
      verdicts: [
        v(0, 'spot', 'hit', 0),
        v(1, 'herb', 'missed', 1),
        v(2, 'tar', 'missed', 2),
        v(3, 'spot', 'missed', 0),
        v(6, 'spot', 'hit', 0),
      ],
      score: score({ hits: 2, missed: 3, wastedTicks: 3, longestStreak: 1 }),
    },
    {
      name: 'a mid-cycle primary press is wrong-tick and re-anchors with no snowball',
      inputs: [
        [0, 'spot'],
        [1, 'spot'],
        [2, 'herb'],
        [3, 'tar'],
        [4, 'spot'],
      ],
      duration: 5,
      verdicts: [
        v(0, 'spot', 'hit', 0),
        v(1, 'spot', 'wrong-tick', 0),
        v(1, 'herb', 'missed', 1),
        v(2, 'herb', 'hit', 1),
        v(3, 'tar', 'hit', 2),
        v(4, 'spot', 'hit', 0),
      ],
      score: score({ hits: 4, wrongTick: 1, missed: 1, longestStreak: 3 }),
    },
    {
      name: 'inputs before the first primary are extra',
      inputs: [
        [0, 'herb'],
        [1, 'net'],
        [2, 'spot'],
        [3, 'herb'],
        [4, 'tar'],
      ],
      duration: 5,
      verdicts: [
        v(0, 'herb', 'extra'),
        v(1, 'net', 'extra'),
        v(2, 'spot', 'hit', 0),
        v(3, 'herb', 'hit', 1),
        v(4, 'tar', 'hit', 2),
      ],
      score: score({ hits: 3, extra: 2, longestStreak: 3 }),
    },
    {
      name: 'a filler pressed at another expectation tick is wrong-tick for its real slot',
      inputs: [
        [0, 'spot'],
        [1, 'herb'],
        [1, 'tar'],
      ],
      duration: 4,
      verdicts: [
        v(0, 'spot', 'hit', 0),
        v(1, 'herb', 'hit', 1),
        v(1, 'tar', 'wrong-tick', 2),
        v(2, 'tar', 'missed', 2),
        v(3, 'spot', 'missed', 0),
      ],
      score: score({ hits: 2, wrongTick: 1, missed: 2, longestStreak: 2 }),
    },
    {
      name: 'a filler pressed against the open expectation is wrong-target',
      inputs: [
        [0, 'spot'],
        [1, 'tar'],
      ],
      duration: 3,
      verdicts: [
        v(0, 'spot', 'hit', 0),
        v(1, 'tar', 'wrong-target', 1),
        v(1, 'herb', 'missed', 1),
        v(2, 'tar', 'missed', 2),
      ],
      score: score({ hits: 1, wrongTarget: 1, missed: 2, longestStreak: 1 }),
    },
    {
      name: 'a late re-anchor pays capped wasted ticks and gap presses are wrong-tick',
      inputs: [
        [0, 'spot'],
        [4, 'herb'],
        [5, 'spot'],
      ],
      duration: 7,
      verdicts: [
        v(0, 'spot', 'hit', 0),
        v(1, 'herb', 'missed', 1),
        v(2, 'tar', 'missed', 2),
        v(3, 'spot', 'missed', 0),
        v(4, 'herb', 'wrong-tick', 1),
        v(5, 'spot', 'wrong-tick', 0),
        v(6, 'herb', 'missed', 1),
      ],
      score: score({ hits: 1, wrongTick: 2, missed: 4, wastedTicks: 2, longestStreak: 1 }),
    },
  ])('$name', ({ inputs, duration, verdicts, score: expectedScore }) => {
    const judgement = judgeRun(run(fishingMethod, inputs, duration), fishingMethod)
    expect(judgement.verdicts).toEqual(verdicts)
    expect(judgement.score).toEqual(expectedScore)
  })
})

describe('judgeRun general', () => {
  it('is deterministic and ignores input timestamps', () => {
    const inputs: Array<[number, string]> = [
      [0, 'spot'],
      [1, 'herb'],
      [2, 'tar'],
      [3, 'spot'],
      [4, 'herb'],
    ]
    const first = judgeRun(run(fishingMethod, inputs, 6), fishingMethod)
    const second = judgeRun(run(fishingMethod, inputs, 6), fishingMethod)
    const shuffled = judgeRun(
      {
        definitionId: fishingMethod.id,
        durationTicks: 6,
        inputs: inputs.map(([tick, target], i) => ({
          tick,
          target,
          timestamp: (inputs.length - i) * 12345,
        })),
      },
      fishingMethod,
    )
    expect(first).toEqual(second)
    expect(first.verdicts).toEqual(shuffled.verdicts)
    expect(first.score).toEqual(shuffled.score)
  })

  it('longestStreak measures the longest run of consecutive hits in tick order', () => {
    const inputs: Array<[number, string]> = [
      [0, 'chin'],
      [1, 'chin'],
      [3, 'chin'],
      [4, 'chin'],
      [5, 'chin'],
    ]
    const judgement = judgeRun(run(chinMethod, inputs, 6), chinMethod)
    expect(judgement.verdicts).toEqual([
      v(0, 'chin', 'hit', 0),
      v(1, 'chin', 'hit', 0),
      v(2, 'chin', 'missed', 0),
      v(3, 'chin', 'hit', 0),
      v(4, 'chin', 'hit', 0),
      v(5, 'chin', 'hit', 0),
    ])
    expect(judgement.score).toEqual(score({ hits: 5, missed: 1, longestStreak: 3 }))
  })
})
