import { TickClock } from './clock'
import { judgeRun } from './judge'
import type { Judgement } from './judge'
import type {
  Input,
  MethodDefinition,
  RunLog,
  RunScore,
  TargetId,
  Tick,
  VerdictEvent,
} from './types'

export interface SimulateInput {
  tick: number
  target: string
}

export function simulate(
  definition: MethodDefinition,
  inputs: Array<SimulateInput>,
  durationTicks: number,
): Judgement {
  const log: RunLog = {
    definitionId: definition.id,
    inputs: inputs.map((input) => ({
      tick: input.tick,
      target: input.target,
      timestamp: input.tick * 600,
    })),
    durationTicks,
  }
  return judgeRun(log, definition)
}

type VerdictListener = (verdict: VerdictEvent) => void

export class EngineSession {
  private readonly definition: MethodDefinition
  private readonly clock: TickClock
  private readonly verdictListeners = new Set<VerdictListener>()
  private inputs: Input[] = []
  private lastCommittedTick = -1

  constructor(definition: MethodDefinition, clock: TickClock = new TickClock()) {
    this.definition = definition
    this.clock = clock
    this.clock.onCommit((tick) => this.judgeCommitted(tick))
  }

  input(target: TargetId): void {
    this.inputs.push({ tick: this.clock.currentTick, target, timestamp: Date.now() })
  }

  start(rate: number = 1): void {
    this.inputs = []
    this.lastCommittedTick = -1
    this.clock.start(rate)
  }

  pause(): void {
    this.clock.pause()
  }

  resume(): void {
    this.clock.resume()
  }

  step(): void {
    this.clock.step()
  }

  stop(): RunLog {
    const log: RunLog = {
      definitionId: this.definition.id,
      inputs: [...this.inputs],
      durationTicks: this.clock.currentTick,
    }
    this.clock.pause()
    return log
  }

  getScore(): RunScore {
    return judgeRun(this.snapshot(this.clock.currentTick), this.definition).score
  }

  getCyclePosition(): number {
    const length = Math.max(1, this.definition.cycleLength)
    if (this.definition.semantics === 'metronomic') {
      return this.clock.currentTick % length
    }
    const anchor = this.lastPrimaryTick() ?? 0
    return Math.min(Math.max(this.clock.currentTick - anchor, 0), length - 1)
  }

  onVerdict(listener: VerdictListener): () => void {
    this.verdictListeners.add(listener)
    return () => {
      this.verdictListeners.delete(listener)
    }
  }

  static replay(log: RunLog, definition: MethodDefinition): Judgement {
    return judgeRun(log, definition)
  }

  private snapshot(durationTicks: Tick): RunLog {
    return {
      definitionId: this.definition.id,
      inputs: [...this.inputs],
      durationTicks,
    }
  }

  private lastPrimaryTick(): Tick | undefined {
    const primary = this.definition.expectedInputs.find((expected) => expected.primary === true)
    if (primary === undefined) return undefined
    return this.inputs.findLast((input) => input.target === primary.target)?.tick
  }

  private judgeCommitted(tick: Tick): void {
    if (tick <= this.lastCommittedTick) return
    this.lastCommittedTick = tick
    const judgement = judgeRun(this.snapshot(tick + 1), this.definition)
    for (const event of judgement.verdicts) {
      if (event.tick !== tick) continue
      for (const listener of this.verdictListeners) listener(event)
    }
  }
}
