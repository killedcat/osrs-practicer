import type { MethodDefinition } from '../engine/types'

export const oneTickChinchompas: MethodDefinition = {
  id: '1t-chinchompas',
  name: '1-Tick Chinchompas',
  description:
    'Aim for one box-trap action every game tick at full speed — an input 0.6 seconds apart, every tick, forever.',
  cycleLength: 1,
  semantics: 'metronomic',
  targets: [{ id: 'trap', label: 'Box trap' }],
  expectedInputs: [{ tickInCycle: 0, target: 'trap', primary: false }],
}
