import type { Tick } from './types'

export type TickListener = (tick: Tick) => void
export type CommitListener = (tick: Tick) => void

const MS_PER_TICK = 600

export class TickClock {
  private readonly now: () => number
  private readonly tickListeners = new Set<TickListener>()
  private readonly commitListeners = new Set<CommitListener>()
  private tickOrigin = 0
  private rateValue = 1
  private tickCount = 0
  private started = false
  private paused = false
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  get currentTick(): Tick {
    if (!this.started || this.paused) return this.tickCount
    return Math.floor(((this.now() - this.tickOrigin) * this.rateValue) / MS_PER_TICK)
  }

  get isPaused(): boolean {
    return this.started && this.paused
  }

  get rate(): number {
    return this.rateValue
  }

  start(rate: number): void {
    this.clearTimer()
    this.started = true
    this.paused = false
    this.rateValue = rate
    this.tickCount = 0
    this.tickOrigin = this.now()
    this.startTimer()
  }

  setRate(rate: number): void {
    if (!this.started) return
    const current = this.currentTick
    this.rateValue = rate
    this.tickOrigin = this.now() - (current * MS_PER_TICK) / rate
    this.startTimer()
  }

  pause(): void {
    if (!this.started || this.paused) return
    this.tickCount = this.currentTick
    this.paused = true
    this.clearTimer()
  }

  resume(): void {
    if (!this.started || !this.paused) return
    this.paused = false
    this.tickOrigin = this.now() - (this.tickCount * MS_PER_TICK) / this.rateValue
    this.startTimer()
  }

  step(): void {
    if (!this.started || !this.paused) return
    this.advanceTo(this.tickCount + 1)
  }

  onTick(listener: TickListener): () => void {
    this.tickListeners.add(listener)
    return () => {
      this.tickListeners.delete(listener)
    }
  }

  onCommit(listener: CommitListener): () => void {
    this.commitListeners.add(listener)
    return () => {
      this.commitListeners.delete(listener)
    }
  }

  private advanceTo(target: Tick): void {
    let next = this.tickCount
    while (next < target) {
      next += 1
      for (const listener of this.tickListeners) listener(next)
      for (const listener of this.commitListeners) listener(next - 1)
    }
    this.tickCount = next
  }

  private startTimer(): void {
    this.clearTimer()
    this.timer = setInterval(() => {
      this.advanceTo(Math.floor(((this.now() - this.tickOrigin) * this.rateValue) / MS_PER_TICK))
    }, Math.max(1, MS_PER_TICK / this.rateValue))
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }
}
