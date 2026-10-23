import { describe, expect, it } from 'vitest'
import { allDefinitions, getMethod, validateDefinition } from './index'
import { oneTickChinchompas } from './1t-chinchompas'

describe('1t-chinchompas definition', () => {
  it('passes validation', () => {
    expect(validateDefinition(oneTickChinchompas)).toEqual([])
  })

  it('is shipped in allDefinitions and retrievable by id', () => {
    expect(allDefinitions).toContain(oneTickChinchompas)
    expect(getMethod('1t-chinchompas')).toBe(oneTickChinchompas)
    expect(getMethod('nope')).toBeUndefined()
  })

  it('is a metronomic one-tick skill on the box trap', () => {
    expect(oneTickChinchompas.semantics).toBe('metronomic')
    expect(oneTickChinchompas.cycleLength).toBe(1)
    expect(oneTickChinchompas.expectedInputs).toEqual([
      { tickInCycle: 0, target: 'trap', primary: false },
    ])
  })
})
