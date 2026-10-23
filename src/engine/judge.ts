import type {
  ExpectedInput,
  Input,
  MethodDefinition,
  RunLog,
  RunScore,
  TargetId,
  Tick,
  Verdict,
  VerdictEvent,
} from './types'

export interface Judgement {
  verdicts: VerdictEvent[]
  score: RunScore
}

interface DueExpectation {
  index: number
  expected: ExpectedInput
}

interface AnchoredCycle {
  anchor: Tick
  consumed: boolean[]
  deadlineMissed: boolean
}

function event(
  tick: Tick,
  target: TargetId,
  verdict: Verdict,
  expectedTickInCycle?: number,
): VerdictEvent {
  if (expectedTickInCycle === undefined) return { tick, target, verdict }
  return { tick, target, verdict, expectedTickInCycle }
}

function tally(verdicts: VerdictEvent[], wastedTicks: number): RunScore {
  const score: RunScore = {
    hits: 0,
    wrongTick: 0,
    wrongTarget: 0,
    missed: 0,
    extra: 0,
    wastedTicks,
    longestStreak: 0,
  }
  let streak = 0
  for (const v of verdicts) {
    if (v.verdict === 'hit') {
      streak += 1
      if (streak > score.longestStreak) score.longestStreak = streak
    } else {
      streak = 0
    }
    switch (v.verdict) {
      case 'hit':
        score.hits += 1
        break
      case 'wrong-tick':
        score.wrongTick += 1
        break
      case 'wrong-target':
        score.wrongTarget += 1
        break
      case 'missed':
        score.missed += 1
        break
      case 'extra':
        score.extra += 1
        break
    }
  }
  return score
}

function applyInput(
  input: Input,
  due: DueExpectation[],
  expecteds: ExpectedInput[],
  t: Tick,
  out: VerdictEvent[],
): void {
  const matchIdx = due.findIndex((d) => d.expected.target === input.target)
  if (matchIdx !== -1) {
    const matched = due.splice(matchIdx, 1)[0]
    out.push(event(t, input.target, 'hit', matched.expected.tickInCycle))
    return
  }
  if (due.length > 0) {
    out.push(event(t, input.target, 'wrong-target', due[0].expected.tickInCycle))
    return
  }
  const known = expecteds.find((e) => e.target === input.target)
  if (known) {
    out.push(event(t, input.target, 'wrong-tick', known.tickInCycle))
    return
  }
  out.push(event(t, input.target, 'extra'))
}

function applyGroup(
  group: Input[],
  due: DueExpectation[],
  expecteds: ExpectedInput[],
  t: Tick,
  out: VerdictEvent[],
): void {
  for (const input of group) applyInput(input, due, expecteds, t, out)
}

function emitMissed(due: DueExpectation[], t: Tick, out: VerdictEvent[]): void {
  for (const d of due) {
    out.push(event(t, d.expected.target, 'missed', d.expected.tickInCycle))
  }
}

function allDueOf(expecteds: ExpectedInput[]): DueExpectation[] {
  return expecteds.map((expected, index) => ({ index, expected }))
}

function groupByTick(inputs: Input[]): Map<Tick, Input[]> {
  const groups = new Map<Tick, Input[]>()
  for (const input of inputs) {
    const group = groups.get(input.tick)
    if (group === undefined) groups.set(input.tick, [input])
    else group.push(input)
  }
  return groups
}

export function freeInventoryTargets(definition: MethodDefinition): Set<TargetId> {
  const referenced = new Set(definition.expectedInputs.map((e) => e.target))
  const free = new Set<TargetId>()
  for (const target of definition.targets) {
    if (target.placement.region === 'inventory' && !referenced.has(target.id)) free.add(target.id)
  }
  return free
}

function judgeableInputs(log: RunLog, definition: MethodDefinition): Input[] {
  const ignored = freeInventoryTargets(definition)
  if (ignored.size === 0) return log.inputs
  return log.inputs.filter((input) => !ignored.has(input.target))
}

function judgeMetronomic(
  log: RunLog,
  definition: MethodDefinition,
): { verdicts: VerdictEvent[]; wastedTicks: number } {
  const length = Math.max(1, definition.cycleLength)
  const expecteds = definition.expectedInputs
  const allDue = allDueOf(expecteds)
  const groups = groupByTick(judgeableInputs(log, definition))
  const verdicts: VerdictEvent[] = []

  for (let t = 0; t < log.durationTicks; t++) {
    const cyclePos = t % length
    const due = allDue.filter((d) => d.expected.tickInCycle === cyclePos)
    applyGroup(groups.get(t) ?? [], due, expecteds, t, verdicts)
    emitMissed(due, t, verdicts)
  }
  return { verdicts, wastedTicks: 0 }
}

function judgeAnchored(
  log: RunLog,
  definition: MethodDefinition,
): { verdicts: VerdictEvent[]; wastedTicks: number } {
  const length = Math.max(1, definition.cycleLength)
  const expecteds = definition.expectedInputs
  const groups = groupByTick(judgeableInputs(log, definition))
  const verdicts: VerdictEvent[] = []
  let wastedTicks = 0

  const primIdx = expecteds.findIndex((e) => e.primary === true)
  const primary = primIdx !== -1 ? expecteds[primIdx] : undefined

  if (primary === undefined) {
    for (let t = 0; t < log.durationTicks; t++) {
      for (const input of groups.get(t) ?? []) {
        verdicts.push(event(t, input.target, 'extra'))
      }
    }
    return { verdicts, wastedTicks }
  }

  const primaryTarget = primary.target
  const primaryOffset = primary.tickInCycle

  const freshCycle = (anchor: Tick): AnchoredCycle => {
    const consumed = expecteds.map(() => false)
    consumed[primIdx] = true
    return { anchor, consumed, deadlineMissed: false }
  }
  const dueAt = (cycle: AnchoredCycle, tickInCycle: number): DueExpectation[] =>
    allDueOf(expecteds).filter(
      (d) => d.expected.tickInCycle === tickInCycle && !cycle.consumed[d.index],
    )
  const transition = (
    verdict: Verdict,
    rest: Input[],
    otherDue: DueExpectation[],
    t: Tick,
  ): AnchoredCycle => {
    verdicts.push(event(t, primaryTarget, verdict, primaryOffset))
    applyGroup(rest, otherDue, expecteds, t, verdicts)
    emitMissed(otherDue, t, verdicts)
    const next = freshCycle(t)
    const openingDue = dueAt(next, 0)
    emitMissed(openingDue, t, verdicts)
    return next
  }

  let cycle: AnchoredCycle | null = null

  for (let t = 0; t < log.durationTicks; t++) {
    const group = groups.get(t) ?? []

    if (cycle === null) {
      const transitionIdx = group.findIndex((i) => i.target === primaryTarget)
      if (transitionIdx === -1) {
        for (const input of group) verdicts.push(event(t, input.target, 'extra'))
        continue
      }
      const opening = freshCycle(t)
      const openingDue = dueAt(opening, 0)
      verdicts.push(event(t, primaryTarget, 'hit', primaryOffset))
      applyGroup(
        group.filter((_, i) => i !== transitionIdx),
        openingDue,
        expecteds,
        t,
        verdicts,
      )
      emitMissed(openingDue, t, verdicts)
      cycle = opening
      continue
    }

    const current = cycle
    const offset = t - current.anchor
    const transitionInput = group.find((i) => i.target === primaryTarget)

    if (offset < length) {
      const due = dueAt(current, offset)
      if (transitionInput === undefined) {
        applyGroup(group, due, expecteds, t, verdicts)
        emitMissed(due, t, verdicts)
        continue
      }
      cycle = transition(
        'wrong-tick',
        group.filter((i) => i !== transitionInput),
        due,
        t,
      )
      continue
    }

    if (transitionInput === undefined) {
      applyGroup(group, [], expecteds, t, verdicts)
      if (!current.deadlineMissed) {
        current.deadlineMissed = true
        verdicts.push(event(t, primaryTarget, 'missed', primaryOffset))
      }
      continue
    }

    const aligned = offset % length === 0
    wastedTicks += Math.min(Math.max(t - (current.anchor + length), 0), length)
    cycle = transition(
      aligned ? 'hit' : 'wrong-tick',
      group.filter((i) => i !== transitionInput),
      [],
      t,
    )
  }

  return { verdicts, wastedTicks }
}

export function judgeRun(log: RunLog, definition: MethodDefinition): Judgement {
  const { verdicts, wastedTicks } =
    definition.semantics === 'anchored'
      ? judgeAnchored(log, definition)
      : judgeMetronomic(log, definition)
  return { verdicts, score: tally(verdicts, wastedTicks) }
}
