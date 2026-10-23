export type Tick = number
export type TargetId = string
export type Verdict = 'hit' | 'wrong-tick' | 'wrong-target' | 'missed' | 'extra'
export type CycleSemantics = 'metronomic' | 'anchored'

export interface TargetSpec {
  id: TargetId
  label: string
  placement: TargetPlacement
}

export type TargetPlacement =
  | { region: 'viewport'; x: number; y: number }
  | { region: 'inventory'; slot?: number }

export interface ExpectedInput {
  tickInCycle: number
  target: TargetId
  primary?: boolean
}

export interface MethodDefinition {
  id: string
  name: string
  description: string
  cycleLength: number
  semantics: CycleSemantics
  targets: TargetSpec[]
  expectedInputs: ExpectedInput[]
}

export interface Input {
  tick: Tick
  target: TargetId
  timestamp: number
}

export interface VerdictEvent {
  tick: Tick
  target: TargetId
  verdict: Verdict
  expectedTickInCycle?: number
}

export interface RunLog {
  definitionId: string
  inputs: Input[]
  durationTicks: number
}

export interface RunScore {
  hits: number
  wrongTick: number
  wrongTarget: number
  missed: number
  extra: number
  wastedTicks: number
  longestStreak: number
}
