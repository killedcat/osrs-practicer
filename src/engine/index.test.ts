import { describe, expect, it } from 'vitest'
import * as engine from './index'

describe('engine public API', () => {
  it('re-exports the session, clock, judge, and inventory entry points', () => {
    expect(engine.EngineSession).toBeTypeOf('function')
    expect(engine.TickClock).toBeTypeOf('function')
    expect(engine.judgeRun).toBeTypeOf('function')
    expect(engine.simulate).toBeTypeOf('function')
    expect(engine.inventoryState).toBeTypeOf('function')
    expect(engine.INVENTORY_CAPACITY).toBe(28)
  })
})
