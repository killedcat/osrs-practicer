import type { MethodDefinition } from '../engine/types'
import { oneTickChinchompas } from './1t-chinchompas'
import { threeTickFishing } from './3t-fishing'
import { threeTickGranite } from './3t-granite'
import { assertValidDefinition, validateDefinition } from './validate'
import type { ValidationError } from './validate'

export { assertValidDefinition, validateDefinition }
export type { ValidationError }

export const allDefinitions: MethodDefinition[] = [
  oneTickChinchompas,
  threeTickFishing,
  threeTickGranite,
]

export function getMethod(id: string): MethodDefinition | undefined {
  return allDefinitions.find((definition) => definition.id === id)
}
