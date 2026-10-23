import { describe, expect, it } from 'vitest'
import type { MethodDefinition, TargetSpec } from '../engine/types'
import { TARGET_ICONS } from '../engine/types'
import { assertValidDefinition, validateDefinition } from './validate'
import type { ValidationError } from './validate'

const metronomic: MethodDefinition = {
  id: '1t-chins',
  name: '1t chins',
  description: 'Throw a chinchompa every tick.',
  cycleLength: 1,
  semantics: 'metronomic',
  targets: [{ id: 'trap', label: 'Box trap', placement: { region: 'viewport', x: 50, y: 50 } }],
  expectedInputs: [{ tickInCycle: 0, target: 'trap', primary: false }],
}

const anchored: MethodDefinition = {
  id: '3t-fishing',
  name: '3t fishing',
  description: 'Fishing spot, guam tar, swamp tar.',
  cycleLength: 2,
  semantics: 'anchored',
  targets: [
    { id: 'spot', label: 'Fishing spot', placement: { region: 'viewport', x: 50, y: 42 } },
    { id: 'guam-tar', label: 'Guam tar', placement: { region: 'inventory', slot: 0 } },
  ],
  expectedInputs: [
    { tickInCycle: 0, target: 'spot', primary: true },
    { tickInCycle: 1, target: 'guam-tar' },
  ],
}

const overridden = (over: Partial<MethodDefinition>): MethodDefinition => ({
  ...metronomic,
  ...over,
})

const targetWith = (placement: unknown): TargetSpec =>
  ({ id: 'trap', label: 'Trap', placement }) as unknown as TargetSpec

const expectError = (def: MethodDefinition, path: string): void => {
  const errors = validateDefinition(def)
  expect(errors).toContainEqual(expect.objectContaining({ path }))
}

describe('validateDefinition', () => {
  it('accepts a valid metronomic definition', () => {
    expect(validateDefinition(metronomic)).toEqual([])
  })

  it('accepts a valid anchored definition', () => {
    expect(validateDefinition(anchored)).toEqual([])
  })

  it('rejects an empty id', () => {
    expectError(overridden({ id: '  ' }), 'id')
  })

  it('rejects an empty name', () => {
    expectError(overridden({ name: '' }), 'name')
  })

  it('rejects a non-positive cycleLength', () => {
    expectError(overridden({ cycleLength: 0, expectedInputs: [] }), 'cycleLength')
  })

  it('rejects a non-integer cycleLength', () => {
    expectError(overridden({ cycleLength: 1.5, expectedInputs: [] }), 'cycleLength')
  })

  it('rejects an empty targets array', () => {
    expectError(overridden({ targets: [] }), 'targets')
  })

  it('rejects duplicate target ids', () => {
    expectError(
      overridden({
        targets: [
          { id: 'trap', label: 'A', placement: { region: 'viewport', x: 40, y: 50 } },
          { id: 'trap', label: 'B', placement: { region: 'viewport', x: 60, y: 50 } },
        ],
      }),
      'targets[1].id',
    )
  })

  it('rejects an empty expectedInputs array', () => {
    expectError(overridden({ expectedInputs: [] }), 'expectedInputs')
  })

  it('rejects a negative tickInCycle', () => {
    expectError(
      overridden({ expectedInputs: [{ tickInCycle: -1, target: 'trap' }] }),
      'expectedInputs[0].tickInCycle',
    )
  })

  it('rejects a tickInCycle at or beyond cycleLength', () => {
    expectError(
      overridden({ cycleLength: 2, expectedInputs: [{ tickInCycle: 2, target: 'trap' }] }),
      'expectedInputs[0].tickInCycle',
    )
  })

  it('rejects a non-integer tickInCycle', () => {
    expectError(
      overridden({ cycleLength: 3, expectedInputs: [{ tickInCycle: 0.5, target: 'trap' }] }),
      'expectedInputs[0].tickInCycle',
    )
  })

  it('rejects an expected input referencing an unknown target', () => {
    expectError(
      overridden({ expectedInputs: [{ tickInCycle: 0, target: 'ghost' }] }),
      'expectedInputs[0].target',
    )
  })

  it('rejects duplicate expected inputs (same tick and target)', () => {
    expectError(
      overridden({
        cycleLength: 3,
        expectedInputs: [
          { tickInCycle: 1, target: 'trap' },
          { tickInCycle: 1, target: 'trap' },
        ],
      }),
      'expectedInputs[1]',
    )
  })

  it('accepts metronomic definitions with zero or several expectations per tick', () => {
    expect(
      validateDefinition(
        overridden({
          targets: [
            { id: 'trap', label: 'Box trap', placement: { region: 'viewport', x: 40, y: 50 } },
            { id: 'net', label: 'Net', placement: { region: 'viewport', x: 60, y: 50 } },
          ],
          cycleLength: 2,
          expectedInputs: [
            { tickInCycle: 0, target: 'trap' },
            { tickInCycle: 0, target: 'net' },
          ],
        }),
      ),
    ).toEqual([])
  })

  it('rejects a metronomic definition with a primary input', () => {
    expectError(
      overridden({ expectedInputs: [{ tickInCycle: 0, target: 'trap', primary: true }] }),
      'expectedInputs',
    )
  })

  it('rejects an anchored definition with no primary input', () => {
    expectError(
      overridden({
        cycleLength: 2,
        semantics: 'anchored',
        expectedInputs: [
          { tickInCycle: 0, target: 'trap' },
          { tickInCycle: 1, target: 'trap' },
        ],
      }),
      'expectedInputs',
    )
  })

  it('rejects an anchored definition with more than one primary input', () => {
    expectError(
      overridden({
        cycleLength: 3,
        semantics: 'anchored',
        expectedInputs: [
          { tickInCycle: 0, target: 'trap', primary: true },
          { tickInCycle: 1, target: 'trap', primary: true },
        ],
      }),
      'expectedInputs',
    )
  })

  it('rejects an anchored definition whose primary is not at tick 0', () => {
    expectError(
      overridden({
        cycleLength: 3,
        semantics: 'anchored',
        targets: [
          { id: 'trap', label: 'Box trap', placement: { region: 'viewport', x: 40, y: 50 } },
          { id: 'net', label: 'Net', placement: { region: 'viewport', x: 60, y: 50 } },
        ],
        expectedInputs: [
          { tickInCycle: 0, target: 'trap' },
          { tickInCycle: 1, target: 'net', primary: true },
        ],
      }),
      'expectedInputs',
    )
  })

  it('reports every failure path, not just the first', () => {
    const errors = validateDefinition({
      ...anchored,
      id: '',
      name: '',
      targets: [],
      expectedInputs: [],
    })
    const paths = errors.map((error) => error.path)
    expect(paths).toEqual(['id', 'name', 'targets', 'expectedInputs', 'expectedInputs'])
  })
})

describe('placement validation', () => {
  const withTargets = (targets: unknown[]): MethodDefinition =>
    overridden({ targets: targets as TargetSpec[] })

  it('rejects a target with no placement', () => {
    expectError(withTargets([targetWith(undefined)]), 'targets[0].placement')
    const errors = validateDefinition(withTargets([targetWith(undefined)]))
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'targets[0].placement',
        message: 'every target must have a placement',
      }),
    )
  })

  it('rejects viewport x outside [0, 100]', () => {
    for (const x of [-1, 100.5, 101, '50' as unknown as number]) {
      expectError(
        withTargets([targetWith({ region: 'viewport', x, y: 50 })]),
        'targets[0].placement.x',
      )
    }
  })

  it('rejects viewport y outside [0, 100]', () => {
    for (const y of [-1, 100.5, 101, '42' as unknown as number]) {
      expectError(
        withTargets([targetWith({ region: 'viewport', x: 50, y })]),
        'targets[0].placement.y',
      )
    }
  })

  it('rejects inventory slots outside [0, 27] or non-integer', () => {
    for (const slot of [-1, 28, 0.5]) {
      expectError(
        withTargets([targetWith({ region: 'inventory', slot })]),
        'targets[0].placement.slot',
      )
    }
  })

  it('rejects duplicate static inventory slots', () => {
    const errors = validateDefinition(
      withTargets([
        targetWith({ region: 'viewport', x: 50, y: 50 }),
        targetWith({ region: 'inventory', slot: 3 }),
        targetWith({ region: 'inventory', slot: 3 }),
      ]),
    )
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'targets[2].placement.slot',
        message: 'static inventory slot 3 is occupied by both "trap" and "trap"',
      }),
    )
  })

  it('requires at least one viewport target', () => {
    expectError(withTargets([targetWith({ region: 'inventory', slot: 0 })]), 'targets')
    const errors = validateDefinition(withTargets([targetWith({ region: 'inventory', slot: 0 })]))
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'targets',
        message: 'at least one viewport target is required',
      }),
    )
  })

  it('rejects an inventory target judged by an expectedInput without a static slot', () => {
    const errors = validateDefinition(
      withTargets([
        targetWith({ region: 'viewport', x: 50, y: 50 }),
        targetWith({ region: 'inventory' }),
      ]),
    )
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'targets[1].placement',
        message:
          'inventory target "trap" is judged by an expectedInput and must declare a static slot',
      }),
    )
  })

  it('accepts an unreferenced dynamic inventory target and distinct static slots', () => {
    const errors = validateDefinition(
      withTargets([
        { id: 'trap', label: 'Trap', placement: { region: 'viewport', x: 50, y: 50 } },
        { id: 'herb', label: 'Herb', placement: { region: 'inventory', slot: 0 } },
        { id: 'fish', label: 'Fish', placement: { region: 'inventory' } },
      ]),
    )
    expect(errors).toEqual([])
  })

  it('accepts a judged inventory target with a static slot', () => {
    expect(
      validateDefinition(
        withTargets([
          { id: 'trap', label: 'Trap', placement: { region: 'viewport', x: 50, y: 50 } },
          { id: 'herb', label: 'Herb', placement: { region: 'inventory', slot: 4 } },
        ]),
      ),
    ).toEqual([])
  })
})

describe('icon validation', () => {
  it('rejects an icon outside the closed set', () => {
    expectError(
      overridden({
        targets: [
          {
            id: 'trap',
            label: 'Trap',
            icon: 'sword',
            placement: { region: 'viewport', x: 50, y: 50 },
          },
        ],
      }),
      'targets[0].icon',
    )
    const errors = validateDefinition(
      overridden({
        targets: [
          {
            id: 'trap',
            label: 'Trap',
            icon: 'sword',
            placement: { region: 'viewport', x: 50, y: 50 },
          },
        ],
      }),
    )
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: 'targets[0].icon',
        message:
          'icon "sword" is not part of the closed icon set (water, rock, trap, leaf, jar, bundle)',
      }),
    )
  })

  it('accepts every icon in the closed set', () => {
    for (const icon of TARGET_ICONS) {
      expect(
        validateDefinition(
          overridden({
            targets: [
              { id: 'trap', label: 'Trap', icon, placement: { region: 'viewport', x: 50, y: 50 } },
            ],
          }),
        ),
      ).toEqual([])
    }
  })

  it('accepts a target with no icon', () => {
    expect(validateDefinition(metronomic)).toEqual([])
  })
})

describe('flavor validation', () => {
  const targetWithFlavor = (flavor: unknown): TargetSpec =>
    ({
      id: 'trap',
      label: 'Trap',
      flavor,
      placement: { region: 'viewport', x: 50, y: 50 },
    }) as unknown as TargetSpec

  it('requires a present flavor to be a non-empty string, and accepts authored or absent flavor', () => {
    for (const flavor of ['', '   ', 42]) {
      expect(
        validateDefinition(overridden({ targets: [targetWithFlavor(flavor)] })),
      ).toContainEqual(
        expect.objectContaining({
          path: 'targets[0].flavor',
          message: 'flavor must be a non-empty string',
        }),
      )
    }
    expect(
      validateDefinition(
        overridden({ targets: [targetWithFlavor('You tend the box trap.')] }),
      ),
    ).toEqual([])
    expect(validateDefinition(metronomic)).toEqual([])
  })
})

describe('assertValidDefinition', () => {
  it('does not throw for a valid definition', () => {
    expect(() => assertValidDefinition(metronomic)).not.toThrow()
  })

  it('throws with the first error path and message', () => {
    expect(() =>
      assertValidDefinition({ ...metronomic, cycleLength: 0, expectedInputs: [] }),
    ).toThrow('cycleLength: cycleLength must be an integer >= 1')
  })
})

describe('error shape', () => {
  it('produces path and message entries', () => {
    const errors: ValidationError[] = validateDefinition({ ...metronomic, id: '' })
    expect(errors).toEqual([{ path: 'id', message: 'id must be a non-empty string' }])
  })
})
