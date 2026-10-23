import { describe, expect, it } from 'vitest'
import { inventoryState, INVENTORY_CAPACITY } from './inventory'
import { judgeRun } from './judge'
import type { MethodDefinition, RunLog, VerdictEvent } from './types'

const fishingBase: MethodDefinition = {
  id: 'fishing-3t',
  name: '3t fishing',
  description: 'Move between spots, drink herb tar, protect with tar.',
  cycleLength: 3,
  semantics: 'anchored',
  targets: [
    { id: 'spot', label: 'Fishing spot' },
    { id: 'herb', label: 'Guam tar' },
    { id: 'tar', label: 'Swamp tar' },
  ],
  expectedInputs: [
    { tickInCycle: 0, target: 'spot', primary: true },
    { tickInCycle: 1, target: 'herb' },
    { tickInCycle: 2, target: 'tar' },
  ],
}

const fishingWithInventory: MethodDefinition = {
  ...fishingBase,
  targets: [
    ...fishingBase.targets,
    { id: 'trout', label: 'Raw trout', inventory: true },
    { id: 'leather', label: 'Cowhide', inventory: true },
  ],
}

const chinWithInventory: MethodDefinition = {
  id: 'chin-1t',
  name: '1t chins',
  description: 'Throw a red chinchompa every tick.',
  cycleLength: 1,
  semantics: 'metronomic',
  targets: [
    { id: 'chin', label: 'Red chinchompa' },
    { id: 'net', label: 'Small fishing net' },
    { id: 'fishtail', label: 'Fish tail', inventory: true },
  ],
  expectedInputs: [{ tickInCycle: 0, target: 'chin' }],
}

const dropMethod: MethodDefinition = {
  id: 'chin-1t-drops',
  name: '1t chins with drops',
  description: 'Throw a red chinchompa every tick; the throw itself lives in the inventory.',
  cycleLength: 1,
  semantics: 'metronomic',
  targets: [
    { id: 'chin', label: 'Red chinchompa', inventory: true },
    { id: 'net', label: 'Small fishing net' },
  ],
  expectedInputs: [{ tickInCycle: 0, target: 'chin' }],
}

const shatterMethod: MethodDefinition = {
  id: 'shatter-1t',
  name: '1t shatter',
  description: 'Tap the anvil every tick, dropping raw ore between swings.',
  cycleLength: 1,
  semantics: 'anchored',
  targets: [
    { id: 'anvil', label: 'Anvil' },
    { id: 'ore', label: 'Raw ore', inventory: true },
  ],
  expectedInputs: [{ tickInCycle: 0, target: 'anvil', primary: true }],
}

const run = (
  definition: MethodDefinition,
  inputs: Array<[number, string]>,
  durationTicks: number,
): RunLog => ({
  definitionId: definition.id,
  inputs: inputs.map(([tick, target]) => ({ tick, target, timestamp: tick * 600 })),
  durationTicks,
})

const hit = (tick: number, target: string, expectedTickInCycle: number): VerdictEvent => ({
  tick,
  target,
  verdict: 'hit',
  expectedTickInCycle,
})
const missed = (tick: number, target: string, expectedTickInCycle: number): VerdictEvent => ({
  tick,
  target,
  verdict: 'missed',
  expectedTickInCycle,
})

describe('free inventory targets are unjudged', () => {
  it('a metronomic drop mid-run produces zero verdict events', () => {
    const judgement = judgeRun(
      run(chinWithInventory, [
        [0, 'chin'],
        [1, 'fishtail'],
        [2, 'chin'],
      ], 3),
      chinWithInventory,
    )
    expect(judgement.verdicts).toEqual([hit(0, 'chin', 0), missed(1, 'chin', 0), hit(2, 'chin', 0)])
    expect(judgement.score).toEqual({
      hits: 2,
      wrongTick: 0,
      wrongTarget: 0,
      missed: 1,
      extra: 0,
      wastedTicks: 0,
      longestStreak: 1,
    })
  })

  it('an anchored drop before the first primary hit never counts as extra', () => {
    const judgement = judgeRun(
      run(fishingWithInventory, [
        [0, 'trout'],
        [2, 'spot'],
      ], 4),
      fishingWithInventory,
    )
    expect(judgement.verdicts).toEqual([hit(2, 'spot', 0), missed(3, 'herb', 1)])
    expect(judgement.score).toEqual({
      hits: 1,
      wrongTick: 0,
      wrongTarget: 0,
      missed: 1,
      extra: 0,
      wastedTicks: 0,
      longestStreak: 1,
    })
  })

  it('judging a log with free drops deep-equals the same log with those drops removed', () => {
    const clean: Array<[number, string]> = [
      [0, 'spot'],
      [1, 'herb'],
      [2, 'tar'],
      [3, 'spot'],
      [4, 'herb'],
    ]
    const dirty: Array<[number, string]> = [
      [0, 'spot'],
      [0, 'trout'],
      [1, 'herb'],
      [1, 'leather'],
      [2, 'tar'],
      [3, 'spot'],
      [3, 'trout'],
      [4, 'herb'],
      [4, 'leather'],
    ]
    const dropped = judgeRun(run(fishingWithInventory, dirty, 5), fishingWithInventory)
    const pristine = judgeRun(run(fishingWithInventory, clean, 5), fishingWithInventory)
    expect(pristine.verdicts).toEqual([
      hit(0, 'spot', 0),
      hit(1, 'herb', 1),
      hit(2, 'tar', 2),
      hit(3, 'spot', 0),
      hit(4, 'herb', 1),
    ])
    expect(dropped).toEqual(pristine)
  })

  it('an inventory target referenced by an expectedInput is judged normally', () => {
    const judgement = judgeRun(
      run(dropMethod, [
        [0, 'chin'],
        [0, 'chin'],
        [1, 'net'],
      ], 2),
      dropMethod,
    )
    expect(judgement.verdicts).toEqual([
      hit(0, 'chin', 0),
      { tick: 0, target: 'chin', verdict: 'wrong-tick', expectedTickInCycle: 0 },
      { tick: 1, target: 'net', verdict: 'wrong-target', expectedTickInCycle: 0 },
      missed(1, 'chin', 0),
    ])
    expect(judgement.score).toEqual({
      hits: 1,
      wrongTick: 1,
      wrongTarget: 1,
      missed: 1,
      extra: 0,
      wastedTicks: 0,
      longestStreak: 1,
    })
  })
})

describe('inventoryState', () => {
  it('capacity is 28', () => {
    expect(INVENTORY_CAPACITY).toBe(28)
  })

  it('counts primary hits as catches', () => {
    const state = inventoryState(
      run(
        fishingWithInventory,
        [
          [0, 'spot'],
          [1, 'herb'],
          [2, 'tar'],
          [3, 'spot'],
          [4, 'herb'],
        ],
        5,
      ),
      fishingWithInventory,
    )
    expect(state).toEqual({ occupied: 2, capacity: 28 })
  })

  it('each free inventory drop removes one caught item', () => {
    const withTwoDrops = inventoryState(
      run(
        fishingWithInventory,
        [
          [0, 'spot'],
          [1, 'herb'],
          [2, 'tar'],
          [3, 'spot'],
          [4, 'herb'],
          [4, 'trout'],
          [5, 'leather'],
        ],
        5,
      ),
      fishingWithInventory,
    )
    expect(withTwoDrops).toEqual({ occupied: 0, capacity: 28 })
    const withOneDrop = inventoryState(
      run(
        fishingWithInventory,
        [
          [0, 'spot'],
          [1, 'herb'],
          [2, 'tar'],
          [3, 'spot'],
          [4, 'herb'],
          [5, 'leather'],
        ],
        5,
      ),
      fishingWithInventory,
    )
    expect(withOneDrop).toEqual({ occupied: 1, capacity: 28 })
  })

  it('metronomic methods have no catches, so drops never go below occupied zero', () => {
    const state = inventoryState(
      run(chinWithInventory, [
        [0, 'chin'],
        [0, 'fishtail'],
        [1, 'fishtail'],
      ], 2),
      chinWithInventory,
    )
    expect(state).toEqual({ occupied: 0, capacity: 28 })
  })

  it('occupied clamps at 28 for a long anchored run', () => {
    const inputs: Array<[number, string]> = []
    for (let t = 0; t < 30; t++) inputs.push([t, 'anvil'])
    const state = inventoryState(run(shatterMethod, inputs, 30), shatterMethod)
    expect(state).toEqual({ occupied: 28, capacity: 28 })
  })

  it('occupied clamps at 0 when drops exceed catches', () => {
    const state = inventoryState(
      run(shatterMethod, [
        [0, 'anvil'],
        [1, 'ore'],
        [1, 'ore'],
        [2, 'ore'],
        [2, 'ore'],
        [3, 'ore'],
      ], 4),
      shatterMethod,
    )
    expect(state).toEqual({ occupied: 0, capacity: 28 })
  })
})
