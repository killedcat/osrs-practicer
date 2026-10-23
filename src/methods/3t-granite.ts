import type { MethodDefinition } from '../engine/types'

export const threeTickGranite: MethodDefinition = {
  id: '3t-granite',
  name: '3-Tick Granite',
  description:
    'Click the granite rock, counting three ticks between every rock click — the rhythm itself is the skill. There are no filler inputs: in the real-time gap you drop mined granite from the inventory, and because those drops are free inventory actions they recorded but never judged, so they can never break the cycle. Miss a rock click and the whole gap is wasted time until the next click re-anchors you.',
  cycleLength: 3,
  semantics: 'anchored',
  targets: [
    { id: 'rock', label: 'Granite rock' },
    { id: 'granite', label: 'Granite', inventory: true },
  ],
  expectedInputs: [{ tickInCycle: 0, target: 'rock', primary: true }],
}
