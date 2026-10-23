import type { MethodDefinition, TargetPlacement, TargetSpec } from '../engine/types'
import { TARGET_ICONS } from '../engine/types'

export interface ValidationError {
  path: string
  message: string
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isInteger = (value: number): boolean => Number.isInteger(value)

interface PlacementCheck {
  path: string
  valid: boolean
  region?: TargetPlacement['region']
  reason?: 'missing' | 'x' | 'y' | 'slot'
}

function checkPlacement(target: TargetSpec, index: number): PlacementCheck {
  const path = `targets[${index}].placement`
  const placement = target.placement as TargetPlacement | undefined
  if (
    placement === undefined ||
    placement === null ||
    typeof placement !== 'object' ||
    (placement.region !== 'viewport' && placement.region !== 'inventory')
  ) {
    return { path, valid: false, reason: 'missing' }
  }
  if (placement.region === 'viewport') {
    const inRange = (value: number): boolean =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    if (!inRange(placement.x)) {
      return { path: `${path}.x`, valid: false, reason: 'x', region: 'viewport' }
    }
    if (!inRange(placement.y)) {
      return { path: `${path}.y`, valid: false, reason: 'y', region: 'viewport' }
    }
    return { path, valid: true, region: 'viewport' }
  }
  const { slot } = placement
  if (slot !== undefined && (!isInteger(slot) || slot < 0 || slot > 27)) {
    return { path: `${path}.slot`, valid: false, reason: 'slot', region: 'inventory' }
  }
  return { path, valid: true, region: 'inventory' }
}

const placementMessages: Record<NonNullable<PlacementCheck['reason']>, string> = {
  missing: 'every target must have a placement',
  x: 'viewport placement x must be a number in [0, 100]',
  y: 'viewport placement y must be a number in [0, 100]',
  slot: 'inventory placement slot must be an integer in [0, 27]',
}

const isKnownIcon = (icon: string): boolean => (TARGET_ICONS as readonly string[]).includes(icon)

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
    const placementResults: PlacementCheck[] = []
    def.targets.forEach((target, index) => {
      if (seenTargets.has(target.id)) {
        errors.push({
          path: `targets[${index}].id`,
          message: `duplicate target id "${target.id}"`,
        })
      }
      seenTargets.add(target.id)
      const placementCheck = checkPlacement(target, index)
      placementResults.push(placementCheck)
      if (!placementCheck.valid) {
        errors.push({
          path: placementCheck.path,
          message: placementMessages[placementCheck.reason!],
        })
      }
      if (target.icon !== undefined && !isKnownIcon(target.icon)) {
        errors.push({
          path: `targets[${index}].icon`,
          message: `icon "${target.icon}" is not part of the closed icon set (${TARGET_ICONS.join(', ')})`,
        })
      }
    })

    const viewportCount = placementResults.filter((p) => p.region === 'viewport').length
    if (viewportCount === 0) {
      errors.push({
        path: 'targets',
        message: 'at least one viewport target is required',
      })
    }

    const seenSlots = new Map<number, string>()
    def.targets.forEach((target, index) => {
      const placementCheck = placementResults[index]
      if (placementCheck.region !== 'inventory') return
      const { slot } = target.placement as TargetPlacement & { slot?: number }
      if (slot === undefined) return
      const existing = seenSlots.get(slot)
      if (existing !== undefined) {
        errors.push({
          path: `targets[${index}].placement.slot`,
          message: `static inventory slot ${slot} is occupied by both "${existing}" and "${target.id}"`,
        })
      } else {
        seenSlots.set(slot, target.id)
      }
    })

    const judgedTargets = Array.isArray(def.expectedInputs)
      ? new Set(def.expectedInputs.map((expected) => expected.target))
      : new Set<string>()
    def.targets.forEach((target, index) => {
      const placementCheck = placementResults[index]
      if (placementCheck.region !== 'inventory') return
      if (!judgedTargets.has(target.id)) return
      const { slot } = target.placement as TargetPlacement & { slot?: number }
      if (slot === undefined) {
        errors.push({
          path: `targets[${index}].placement`,
          message: `inventory target "${target.id}" is judged by an expectedInput and must declare a static slot`,
        })
      }
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
