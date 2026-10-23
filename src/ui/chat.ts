import type { MethodDefinition, Tick, VerdictEvent } from '../engine'

export type ChatKind = 'info' | 'good' | 'bad'

export interface ChatLine {
  text: string
  kind: ChatKind
}

export const CHAT_BUFFER_MAX = 50
export const REPLAY_CHAT_LINES = 12

export function labelOf(definition: MethodDefinition, targetId: string): string {
  return definition.targets.find((target) => target.id === targetId)?.label ?? targetId
}

export function flavorLineFor(definition: MethodDefinition, targetId: string): string {
  const flavor = definition.targets.find((target) => target.id === targetId)?.flavor
  if (flavor !== undefined && flavor.trim().length > 0) return flavor
  return `You interact with the ${labelOf(definition, targetId).toLowerCase()}.`
}

export function errorLineFor(event: VerdictEvent, definition: MethodDefinition): string {
  const label = labelOf(definition, event.target).toLowerCase()
  const tick = `(tick ${event.tick})`
  switch (event.verdict) {
    case 'missed':
      return `Missed: ${label} ${tick}`
    case 'wrong-tick':
      return `Wrong tick: ${label} ${tick}`
    case 'wrong-target':
      return `Wrong target: ${label} ${tick}`
    default:
      return `Extra click ${tick}`
  }
}

export function wastedLine(count: number): string {
  return `Wasted ${count} tick${count === 1 ? '' : 's'}.`
}

export function pushChat(buffer: ChatLine[], line: ChatLine): void {
  buffer.push(line)
  if (buffer.length > CHAT_BUFFER_MAX) buffer.splice(0, buffer.length - CHAT_BUFFER_MAX)
}

export interface ChatStreamState {
  missedPrimaryTick: number | undefined
}

export function initialChatStreamState(): ChatStreamState {
  return { missedPrimaryTick: undefined }
}

export function verdictGroups(verdicts: VerdictEvent[]): Map<Tick, VerdictEvent[]> {
  const groups = new Map<Tick, VerdictEvent[]>()
  for (const event of verdicts) {
    const group = groups.get(event.tick)
    if (group === undefined) groups.set(event.tick, [event])
    else group.push(event)
  }
  return groups
}

export function chatLinesForTick(
  events: VerdictEvent[],
  definition: MethodDefinition,
  state: ChatStreamState,
): ChatLine[] {
  const lines: ChatLine[] = []
  const primaryTarget =
    definition.semantics === 'anchored'
      ? definition.expectedInputs.find((expected) => expected.primary === true)?.target
      : undefined
  const cycleLength = Math.max(1, definition.cycleLength)
  for (const event of events) {
    if (event.verdict !== 'hit') {
      lines.push({ text: errorLineFor(event, definition), kind: 'bad' })
    } else if (primaryTarget !== undefined && event.target === primaryTarget) {
      lines.push({ text: flavorLineFor(definition, event.target), kind: 'good' })
    }
    if (primaryTarget === undefined || event.target !== primaryTarget) continue
    if (event.verdict === 'missed') {
      state.missedPrimaryTick = event.tick
      continue
    }
    if (state.missedPrimaryTick === undefined) continue
    const count = Math.min(Math.max(event.tick - state.missedPrimaryTick, 1), cycleLength)
    lines.push({ text: wastedLine(count), kind: 'bad' })
    state.missedPrimaryTick = undefined
  }
  return lines
}

export function chatLinesThrough(
  verdicts: VerdictEvent[],
  definition: MethodDefinition,
  toTick: Tick,
): ChatLine[] {
  const groups = verdictGroups(verdicts)
  const state: ChatStreamState = { missedPrimaryTick: undefined }
  const lines: ChatLine[] = []
  for (let t = 0; t <= toTick; t += 1) {
    lines.push(...chatLinesForTick(groups.get(t) ?? [], definition, state))
  }
  return lines
}
