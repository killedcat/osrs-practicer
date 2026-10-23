import { describe, expect, it } from 'vitest'
import * as engine from './index'

describe('engine public API', () => {
  it('re-exports the session, clock, and judge entry points', () => {
    expect(engine.EngineSession).toBeTypeOf('function')
    expect(engine.TickClock).toBeTypeOf('function')
    expect(engine.judgeRun).toBeTypeOf('function')
    expect(engine.simulate).toBeTypeOf('function')
  })
})
