import { describe, expect, it } from 'vitest'
import type { MethodDefinition } from '../engine/types'
import { assertValidDefinition, validateDefinition } from './validate'
import type { ValidationError } from './validate'

const metronomic: MethodDefinition = {
  id: '1t-chins',
  name: '1t chins',
  description: 'Throw a chinchompa every tick.',
  cycleLength: 1,
  semantics: 'metronomic',
  targets: [{ id: 'trap', label: 'Box trap' }],
  expectedInputs: [{ tickInCycle: 0, target: 'trap', primary: false }],
}

const anchored: MethodDefinition = {
  id: '3t-fishing',
  name: '3t fishing',
  description: 'Fishing spot, guam tar, swamp tar.',
  cycleLength: 2,
  semantics: 'anchored',
  targets: [
    { id: 'spot', label: 'Fishing spot' },
    { id: 'guam-tar', label: 'Guam tar' },
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
          { id: 'trap', label: 'A' },
          { id: 'trap', label: 'B' },
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
            { id: 'trap', label: 'Box trap' },
            { id: 'net', label: 'Net' },
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
          { id: 'trap', label: 'Box trap' },
          { id: 'net', label: 'Net' },
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
