import type { MethodDefinition } from '../engine/types'

export interface ValidationError {
  path: string
  message: string
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isInteger = (value: number): boolean => Number.isInteger(value)

export function validateDefinition(def: MethodDefinition): ValidationError[] {
  const errors: ValidationError[] = []
  const seenTargets = new Set<string>()

  if (!nonEmptyString(def.id)) {
    errors.push({ path: 'id', message: 'id must be a non-empty string' })
  }

  if (!nonEmptyString(def.name)) {
    errors.push({ path: 'name', message: 'name must be a non-empty string' })
  }

  if (!isInteger(def.cycleLength) || def.cycleLength < 1) {
    errors.push({
      path: 'cycleLength',
      message: 'cycleLength must be an integer >= 1',
    })
  }

  if (def.semantics !== 'metronomic' && def.semantics !== 'anchored') {
    errors.push({
      path: 'semantics',
      message: 'semantics must be "metronomic" or "anchored"',
    })
  }

  if (!Array.isArray(def.targets) || def.targets.length === 0) {
    errors.push({ path: 'targets', message: 'targets must be a non-empty array' })
  } else {
    def.targets.forEach((target, index) => {
      if (seenTargets.has(target.id)) {
        errors.push({
          path: `targets[${index}].id`,
          message: `duplicate target id "${target.id}"`,
        })
      }
      seenTargets.add(target.id)
    })
  }

  if (!Array.isArray(def.expectedInputs) || def.expectedInputs.length === 0) {
    errors.push({
      path: 'expectedInputs',
      message: 'expectedInputs must be a non-empty array',
    })
  } else {
    const validCycleLength = isInteger(def.cycleLength) && def.cycleLength >= 1
    const seen = new Set<string>()

    def.expectedInputs.forEach((expected, index) => {
      const inCycle =
        validCycleLength && expected.tickInCycle >= 0 && expected.tickInCycle < def.cycleLength
      if (!isInteger(expected.tickInCycle) || !inCycle) {
        errors.push({
          path: `expectedInputs[${index}].tickInCycle`,
          message: 'tickInCycle must be an integer in [0, cycleLength)',
        })
      }
      if (!seenTargets.has(expected.target)) {
        errors.push({
          path: `expectedInputs[${index}].target`,
          message: `target "${expected.target}" does not reference an existing target id`,
        })
      }
      const key = `${expected.tickInCycle}|${expected.target}`
      if (seen.has(key)) {
        errors.push({
          path: `expectedInputs[${index}]`,
          message: `duplicate expected input for tick ${expected.tickInCycle} on target "${expected.target}"`,
        })
      }
      seen.add(key)
    })
  }

  const primaryFlags = Array.isArray(def.expectedInputs)
    ? def.expectedInputs.filter((expected) => expected.primary === true)
    : []

  if (def.semantics === 'metronomic' && primaryFlags.length > 0) {
    errors.push({
      path: 'expectedInputs',
      message: 'metronomic methods must not declare a primary input',
    })
  }

  if (def.semantics === 'anchored') {
    if (primaryFlags.length !== 1) {
      errors.push({
        path: 'expectedInputs',
        message: 'anchored methods must have exactly one primary input',
      })
    } else if (primaryFlags[0].tickInCycle !== 0) {
      errors.push({
        path: 'expectedInputs',
        message: 'the primary input of an anchored method must be at tick 0',
      })
    }
  }

  return errors
}

export function assertValidDefinition(def: MethodDefinition): void {
  const errors = validateDefinition(def)
  if (errors.length > 0) {
    const [first] = errors
    throw new Error(`${first.path}: ${first.message}`)
  }
}
