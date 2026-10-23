import { describe, expect, it } from 'vitest'
import { allDefinitions } from '../methods'
import { TARGET_ICONS } from '../engine/types'
import clientShellSource from './ClientShell.svelte?raw'
import targetIconSource from './TargetIcon.svelte?raw'

describe('client shell', () => {
  it('contains no hardcoded method ids or names', () => {
    for (const definition of allDefinitions) {
      expect(clientShellSource).not.toContain(definition.id)
      expect(clientShellSource).not.toContain(definition.name)
    }
  })

  it('maps over the definition targets for the viewport and the inventory panel', () => {
    expect(clientShellSource).toContain('definition.targets')
    expect(clientShellSource).toContain('{#each viewportTargets as target (target.id)}')
    expect(clientShellSource).toContain('{#each slotTargets as target, index (index)}')
  })
})

describe('target icon set', () => {
  it('renders every icon in the closed set plus a fallback', () => {
    for (const icon of TARGET_ICONS) {
      expect(targetIconSource).toContain(`icon === '${icon}'`)
    }
  })
})
