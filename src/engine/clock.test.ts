import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TickClock } from './clock'

let time = 0
let tickEvents: number[]
let commitEvents: number[]

const now = () => time

const advanceTime = (ms: number) => {
  time += ms
  vi.advanceTimersByTime(ms)
}

const makeClock = (rate: number) => {
  const clock = new TickClock(now)
  clock.onTick((tick) => tickEvents.push(tick))
  clock.onCommit((tick) => commitEvents.push(tick))
  clock.start(rate)
  return clock
}

describe('TickClock', () => {
  beforeEach(() => {
    time = 0
    tickEvents = []
    commitEvents = []
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rate 1.0 emits one tick per 600ms', () => {
    const clock = makeClock(1)

    advanceTime(599)
    expect(clock.currentTick).toBe(0)
    expect(tickEvents).toEqual([])

    advanceTime(1)
    expect(tickEvents).toEqual([1])

    advanceTime(600)
    expect(tickEvents).toEqual([1, 2])
  })

  it('rate 0.5 advances one tick per 1200ms', () => {
    const clock = makeClock(0.5)

    advanceTime(600)
    expect(clock.currentTick).toBe(0)
    expect(tickEvents).toEqual([])

    advanceTime(600)
    expect(tickEvents).toEqual([1])
    expect(clock.currentTick).toBe(1)

    advanceTime(1200)
    expect(tickEvents).toEqual([1, 2])
  })

  it('emits one commit per completed tick as the next tick begins', () => {
    makeClock(1)
    advanceTime(1800)

    expect(tickEvents).toEqual([1, 2, 3])
    expect(commitEvents).toEqual([0, 1, 2])
  })

  it('pause freezes the clock at the current tick', () => {
    const clock = makeClock(1)
    advanceTime(1300)

    expect(clock.currentTick).toBe(2)

    clock.pause()
    advanceTime(2400)

    expect(clock.isPaused).toBe(true)
    expect(clock.currentTick).toBe(2)
    expect(tickEvents).toEqual([1, 2])
    expect(commitEvents).toEqual([0, 1])
  })

  it('step advances exactly one tick while paused', () => {
    const clock = makeClock(1)
    advanceTime(600)
    clock.pause()

    clock.step()
    expect(clock.currentTick).toBe(2)
    expect(tickEvents).toEqual([1, 2])
    expect(commitEvents).toEqual([0, 1])

    clock.step()
    expect(clock.currentTick).toBe(3)
    expect(tickEvents).toEqual([1, 2, 3])
    expect(commitEvents).toEqual([0, 1, 2])
  })

  it('step does nothing while running', () => {
    const clock = makeClock(1)
    advanceTime(600)

    clock.step()

    expect(clock.currentTick).toBe(1)
    expect(tickEvents).toEqual([1])
  })

  it('resume continues from where it left off', () => {
    const clock = makeClock(1)
    advanceTime(1800)
    clock.pause()
    advanceTime(1200)

    clock.resume()
    expect(clock.isPaused).toBe(false)
    expect(clock.currentTick).toBe(3)

    advanceTime(600)
    expect(tickEvents).toEqual([1, 2, 3, 4])
    expect(clock.currentTick).toBe(4)
  })

  it('setRate changes pace without skipping ticks', () => {
    const clock = makeClock(1)
    advanceTime(1200)
    expect(tickEvents).toEqual([1, 2])

    clock.setRate(0.5)
    expect(clock.rate).toBe(0.5)

    advanceTime(600)
    expect(tickEvents).toEqual([1, 2])
    expect(clock.currentTick).toBe(2)

    advanceTime(600)
    expect(tickEvents).toEqual([1, 2, 3])
    expect(clock.currentTick).toBe(3)
  })

  it('start after start restarts from tick 0 without doubling timers', () => {
    const clock = makeClock(1)
    advanceTime(1800)
    expect(tickEvents).toEqual([1, 2, 3])

    clock.start(1)
    expect(clock.currentTick).toBe(0)

    advanceTime(600)
    expect(tickEvents).toEqual([1, 2, 3, 1])
  })

  it('emits every boundary crossed between polls exactly once', () => {
    makeClock(1)
    time = 1800
    vi.advanceTimersByTime(600)

    expect(tickEvents).toEqual([1, 2, 3])
    expect(commitEvents).toEqual([0, 1, 2])
  })

  it('returned unsubscribe functions remove listeners', () => {
    const clock = new TickClock(now)
    const stopTick = clock.onTick((tick) => tickEvents.push(tick))
    const stopCommit = clock.onCommit((tick) => commitEvents.push(tick))
    clock.start(1)

    advanceTime(600)
    expect(tickEvents).toEqual([1])
    expect(commitEvents).toEqual([0])

    stopTick()
    stopCommit()
    advanceTime(600)

    expect(tickEvents).toEqual([1])
    expect(commitEvents).toEqual([0])
  })
})
