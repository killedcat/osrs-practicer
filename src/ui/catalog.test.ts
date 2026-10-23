import { describe, expect, it } from 'vitest'
import { allDefinitions } from '../methods'
import { oneTickChinchompas } from '../methods/1t-chinchompas'
import { threeTickFishing } from '../methods/3t-fishing'
import { threeTickGranite } from '../methods/3t-granite'
import catalogSource from './Catalog.svelte?raw'
import appSource from './App.svelte?raw'
import practiceSource from './Practice.svelte?raw'

describe('catalog home screen', () => {
  it('ships every registered method in allDefinitions', () => {
    expect(allDefinitions).toContain(oneTickChinchompas)
    expect(allDefinitions).toContain(threeTickFishing)
    expect(allDefinitions).toContain(threeTickGranite)
  })

  it('Catalog renders as a map over allDefinitions with zero hardcoded method ids or names', () => {
    expect(catalogSource).toContain('{#each allDefinitions as')
    for (const definition of allDefinitions) {
      expect(catalogSource).not.toContain(definition.id)
      expect(catalogSource).not.toContain(definition.name)
    }
  })

  it('App router performs no method-id lookups and hardcodes no method ids or names', () => {
    expect(appSource).not.toContain('getMethod')
    for (const definition of allDefinitions) {
      expect(appSource).not.toContain(definition.id)
      expect(appSource).not.toContain(definition.name)
    }
  })

  it('Practice stays coupled to the definition prop, not to any fixed method', () => {
    for (const definition of allDefinitions) {
      expect(practiceSource).not.toContain(definition.id)
      expect(practiceSource).not.toContain(definition.name)
    }
  })

  it('every definition exposes the fields the catalog card renders', () => {
    for (const definition of allDefinitions) {
      expect(definition.name).not.toBe('')
      expect(definition.description).not.toBe('')
      expect(definition.semantics).toMatch(/^(metronomic|anchored)$/)
      expect(definition.cycleLength).toBeGreaterThan(0)
    }
  })
})
