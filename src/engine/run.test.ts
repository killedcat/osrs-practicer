import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TickClock } from './clock'
import { EngineSession, simulate } from './run'
import type { MethodDefinition, RunScore, Verdict, VerdictEvent } from './types'

const chinMethod: MethodDefinition = {
  id: 'chin-1t',
  name: '1t chins',
  description: 'Throw a red chinchompa every tick.',
  cycleLength: 1,
  semantics: 'metronomic',
  targets: [
    { id: 'chin', label: 'Red chinchompa' },
    { id: 'net', label: 'Small fishing net' },
  ],
  expectedInputs: [{ tickInCycle: 0, target: 'chin' }],
}

const dblMethod: MethodDefinition = {
  id: 'dbl-2t',
  name: '2t cycle',
  description: 'Alternate two actions every two ticks.',
  cycleLength: 2,
  semantics: 'metronomic',
  targets: [
    { id: 'a', label: 'Action A' },
    { id: 'b', label: 'Action B' },
  ],
  expectedInputs: [
    { tickInCycle: 0, target: 'a' },
    { tickInCycle: 1, target: 'b' },
  ],
}

const fishingMethod: MethodDefinition = {
  id: 'fishing-3t',
  name: '3t fishing',
  description: 'Move between spots, drink herb tar, protect with tar.',
  cycleLength: 3,
  semantics: 'anchored',
  targets: [
    { id: 'spot', label: 'Fishing spot' },
    { id: 'herb', label: 'Guam tar' },
    { id: 'tar', label: 'Swamp tar' },
    { id: 'net', label: 'Small fishing net' },
  ],
  expectedInputs: [
    { tickInCycle: 0, target: 'spot', primary: true },
    { tickInCycle: 1, target: 'herb' },
    { tickInCycle: 2, target: 'tar' },
  ],
}

const v = (tick: number, target: string, verdict: Verdict, exp?: number): VerdictEvent =>
  exp === undefined ? { tick, target, verdict } : { tick, target, verdict, expectedTickInCycle: exp }

const zeroScore: RunScore = {
  hits: 0,
  wrongTick: 0,
  wrongTarget: 0,
  missed: 0,
  extra: 0,
  wastedTicks: 0,
  longestStreak: 0,
}

const score = (over: Partial<RunScore>): RunScore => ({ ...zeroScore, ...over })

let time = 0

const advance = (ms: number) => {
  time += ms
  vi.advanceTimersByTime(ms)
}

const makeClock = (): TickClock => new TickClock(() => time)

beforeEach(() => {
  time = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EngineSession input quantization', () => {
  it('records an input at the current tick while running', () => {
    const session = new EngineSession(chinMethod, makeClock())
    session.start(1)
    advance(600)
    session.input('chin')
    const log = session.stop()
    expect(log.inputs.map((i) => [i.tick, i.target])).toEqual([[1, 'chin']])
  })

  it('records inputs on the frozen tick while paused', () => {
    const clock = makeClock()
    const session = new EngineSession(chinMethod, clock)
    session.start(1)
    advance(1200)
    clock.pause()
    session.input('chin')
    advance(2400)
    session.input('net')
    const log = session.stop()
    expect(log.inputs.map((i) => [i.tick, i.target])).toEqual([
      [2, 'chin'],
      [2, 'net'],
    ])
  })

  it('keeps input quantization continuous across a mid-run rate change', () => {
    const clock = makeClock()
    const session = new EngineSession(chinMethod, clock)
    session.start(1)
    advance(1200)
    expect(clock.currentTick).toBe(2)

    clock.setRate(0.5)
    session.input('chin')
    advance(1200)
    session.input('chin')

    const log = session.stop()
    expect(log.inputs.map((i) => [i.tick, i.target])).toEqual([
      [2, 'chin'],
      [3, 'chin'],
    ])
  })

  it('keeps multiple inputs on the same tick in insertion order', () => {
    const session = new EngineSession(chinMethod, makeClock())
    session.start(1)
    session.input('chin')
    session.input('net')
    session.input('chin')
    const log = session.stop()
    expect(log.inputs.every((i) => i.tick === 0)).toBe(true)
    expect(log.inputs.map((i) => i.target)).toEqual(['chin', 'net', 'chin'])
  })

  it('quantizes to tick zero before the clock starts rather than the raw clock time', () => {
    time = 2400
    const clock = makeClock()
    const session = new EngineSession(chinMethod, clock)
    session.input('chin')
    const log = session.stop()
    expect(log.inputs[0]).toMatchObject({ tick: 0, target: 'chin' })
    expect(log.durationTicks).toBe(0)
  })
})

describe('EngineSession judging on commit', () => {
  it('emits the verdict events of each tick exactly once, at its commit', () => {
    const session = new EngineSession(chinMethod, makeClock())
    const verdicts: VerdictEvent[] = []
    session.onVerdict((event) => verdicts.push(event))
    session.start(1)
    session.input('chin')
    advance(1200)

    expect(verdicts).toEqual([v(0, 'chin', 'hit', 0), v(1, 'chin', 'missed', 0)])

    advance(600)
    expect(verdicts).toEqual([v(0, 'chin', 'hit', 0), v(1, 'chin', 'missed', 0), v(2, 'chin', 'missed', 0)])

    const log = session.stop()
    expect(EngineSession.replay(log, chinMethod).verdicts).toEqual(verdicts)
  })

  it('step() commits the frozen tick and emits its events', () => {
    const clock = makeClock()
    const session = new EngineSession(chinMethod, clock)
    const verdicts: VerdictEvent[] = []
    session.onVerdict((event) => verdicts.push(event))
    session.start(1)
    advance(600)
    clock.pause()
    session.input('chin')

    expect(verdicts).toEqual([v(0, 'chin', 'missed', 0)])

    clock.step()
    expect(verdicts).toEqual([v(0, 'chin', 'missed', 0), v(1, 'chin', 'hit', 0)])

    clock.step()
    expect(verdicts).toEqual([v(0, 'chin', 'missed', 0), v(1, 'chin', 'hit', 0), v(2, 'chin', 'missed', 0)])
  })

  it('onVerdict returns an unsubscribe that stops future events', () => {
    const session = new EngineSession(chinMethod, makeClock())
    const verdicts: VerdictEvent[] = []
    const unsubscribe = session.onVerdict((event) => verdicts.push(event))
    unsubscribe()
    session.start(1)
    advance(600)
    expect(verdicts).toEqual([])
  })
})

describe('EngineSession lifecycle', () => {
  it('stop returns the full log with timestamps and pauses the clock', () => {
    const clock = makeClock()
    const stamp = Date.now()
    const session = new EngineSession(chinMethod, clock)
    session.start(1)
    session.input('chin')
    advance(600)
    session.input('net')
    const log = session.stop()

    expect(log.definitionId).toBe('chin-1t')
    expect(log.durationTicks).toBe(1)
    expect(log.inputs[0]).toEqual({ tick: 0, target: 'chin', timestamp: stamp })
    expect(log.inputs[1]).toEqual({ tick: 1, target: 'net', timestamp: Date.now() })
    expect(clock.isPaused).toBe(true)
    expect(clock.currentTick).toBe(1)
  })

  it('a second start() resets the log, score, and tick to zero', () => {
    const session = new EngineSession(chinMethod, makeClock())
    session.start(1)
    session.input('chin')
    advance(1200)
    expect(session.getScore().hits).toBe(1)

    session.start(1)
    session.input('net')

    expect(session.getScore().hits).toBe(0)
    const log = session.stop()
    expect(log.inputs.map((i) => [i.tick, i.target])).toEqual([[0, 'net']])
    expect(log.durationTicks).toBe(0)
  })
})

describe('EngineSession.getScore', () => {
  it('reflects hits and misses of the ticks judged so far', () => {
    const session = new EngineSession(chinMethod, makeClock())
    session.start(1)
    session.input('chin')
    advance(1200)
    expect(session.getScore()).toEqual(score({ hits: 1, missed: 1, longestStreak: 1 }))
  })

  it('is all zeros before any tick completes', () => {
    const session = new EngineSession(chinMethod, makeClock())
    session.start(1)
    expect(session.getScore()).toEqual(zeroScore)
  })
})

describe('EngineSession.replay', () => {
  it('reproduces the live judgement for the same inputs', () => {
    const session = new EngineSession(fishingMethod, makeClock())
    const live: VerdictEvent[] = []
    session.onVerdict((event) => live.push(event))
    session.start(1)
    advance(600)
    session.input('net')
    advance(600)
    session.input('spot')
    advance(600)
    session.input('herb')
    advance(600)
    const log = session.stop()
    const replayed = EngineSession.replay(log, fishingMethod)

    expect(replayed.verdicts).toEqual(live)
    expect(replayed.verdicts).toEqual([v(1, 'net', 'extra'), v(2, 'spot', 'hit', 0), v(3, 'herb', 'hit', 1)])
    expect(replayed.score).toEqual(score({ hits: 2, extra: 1, longestStreak: 2 }))
  })
})

describe('simulate', () => {
  it('judges a synthetic log without a live session', () => {
    const judgement = simulate(
      fishingMethod,
      [
        { tick: 0, target: 'spot' },
        { tick: 1, target: 'herb' },
        { tick: 2, target: 'tar' },
      ],
      3,
    )
    expect(judgement.verdicts).toEqual([v(0, 'spot', 'hit', 0), v(1, 'herb', 'hit', 1), v(2, 'tar', 'hit', 2)])
    expect(judgement.score).toEqual(score({ hits: 3, longestStreak: 3 }))
  })
})

describe('EngineSession.getCyclePosition', () => {
  it('wraps around cycleLength for metronomic methods', () => {
    const session = new EngineSession(dblMethod, makeClock())
    session.start(1)
    expect(session.getCyclePosition()).toBe(0)
    advance(600)
    expect(session.getCyclePosition()).toBe(1)
    advance(600)
    expect(session.getCyclePosition()).toBe(0)
    advance(600)
    expect(session.getCyclePosition()).toBe(1)
  })

  it('measures offset from the last primary input for anchored methods and clamps to the cycle', () => {
    const session = new EngineSession(fishingMethod, makeClock())
    session.start(1)
    advance(1200)
    expect(session.getCyclePosition()).toBe(2)
    session.input('spot')
    expect(session.getCyclePosition()).toBe(0)
    advance(600)
    expect(session.getCyclePosition()).toBe(1)
    advance(1200)
    expect(session.getCyclePosition()).toBe(2)
  })
})
