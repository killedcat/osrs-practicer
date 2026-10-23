import { freeInventoryTargets, judgeRun } from './judge'
import type { MethodDefinition, RunLog } from './types'

export const INVENTORY_CAPACITY = 28

export interface InventoryState {
  occupied: number
  capacity: number
}

export function inventoryState(log: RunLog, definition: MethodDefinition): InventoryState {
  const { verdicts } = judgeRun(log, definition)
  const primaryTargets = new Set(
    definition.expectedInputs.filter((e) => e.primary === true).map((e) => e.target),
  )
  let catches = 0
  if (definition.semantics === 'anchored') {
    for (const v of verdicts) {
      if (v.verdict === 'hit' && primaryTargets.has(v.target)) catches += 1
    }
  }
  const free = freeInventoryTargets(definition)
  let drops = 0
  for (const input of log.inputs) {
    if (free.has(input.target)) drops += 1
  }
  const occupied = Math.min(Math.max(catches - drops, 0), INVENTORY_CAPACITY)
  return { occupied, capacity: INVENTORY_CAPACITY }
}
