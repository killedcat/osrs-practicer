import type { MethodDefinition } from '../engine/types'

export const threeTickFishing: MethodDefinition = {
  id: '3t-fishing',
  name: '3-Tick Fishing',
  description:
    'Two filler ticks mix herb tar — rub a clean guam on the first, grind it into swamp tar on the second — and the third tick clicks a fishing spot to catch. Rhythm is anchored on the spot click: miss it and the gap is wasted time until the next spot click re-anchors you.',
  cycleLength: 3,
  semantics: 'anchored',
  targets: [
    { id: 'spot', label: 'Fishing spot' },
    { id: 'herb', label: 'Clean guam' },
    { id: 'tar', label: 'Swamp tar' },
    { id: 'fish', label: 'Fish', inventory: true },
  ],
  expectedInputs: [
    { tickInCycle: 0, target: 'spot', primary: true },
    { tickInCycle: 1, target: 'herb' },
    { tickInCycle: 2, target: 'tar' },
  ],
}
