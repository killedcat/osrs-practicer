import { describe, expect, it } from 'vitest'
import { judgeRun } from '../engine'
import type { Input, RunLog } from '../engine'
import { threeTickFishing } from '../methods/3t-fishing'
import replaySource from './Replay.svelte?raw'

const inputs: Input[] = [
  { tick: 0, target: 'spot', timestamp: 0 },
  { tick: 1, target: 'herb', timestamp: 600 },
  { tick: 2, target: 'tar', timestamp: 1200 },
  { tick: 3, target: 'spot', timestamp: 1800 },
  { tick: 4, target: 'herb', timestamp: 2400 },
  { tick: 5, target: 'tar', timestamp: 3000 },
  { tick: 9, target: 'spot', timestamp: 5400 },
  { tick: 10, target: 'herb', timestamp: 6000 },
  { tick: 11, target: 'tar', timestamp: 6600 },
]

const runLog: RunLog = {
  definitionId: threeTickFishing.id,
  inputs,
  durationTicks: 12,
}

function logThroughTick(log: RunLog, toTick: number): RunLog {
  return {
    definitionId: log.definitionId,
    inputs: log.inputs.filter((input) => input.tick <= toTick),
    durationTicks: toTick + 1,
  }
}

describe('replay determinism: scrub state equals live state', () => {
  it('pins the synthetic log as two perfect anchored cycles plus one missed primary', () => {
    const full = judgeRun(runLog, threeTickFishing)
    expect(full.score.hits).toBe(9)
    expect(full.score.missed).toBe(1)
    expect(full.score.wastedTicks).toBe(3)
    expect(full.verdicts.some((event) => event.verdict === 'missed' && event.tick === 6)).toBe(
      true,
    )
    expect(full.verdicts.some((event) => event.verdict === 'hit' && event.tick === 9)).toBe(true)
  })

  it('per-tick prefix judgements deep-equal the full-run verdicts filtered to tick <= T', () => {
    const full = judgeRun(runLog, threeTickFishing)
    for (let t = 0; t < runLog.durationTicks; t++) {
      const prefix = judgeRun(logThroughTick(runLog, t), threeTickFishing)
      expect(prefix.verdicts).toEqual(full.verdicts.filter((event) => event.tick <= t))
    }
  })

  it('the prefix judgement at the last tick equals the full-run judgement', () => {
    const full = judgeRun(runLog, threeTickFishing)
    const last = judgeRun(logThroughTick(runLog, runLog.durationTicks - 1), threeTickFishing)
    expect(last).toEqual(full)
  })
})

describe('Replay review flow drives the same engine', () => {
  it('re-simulates through judgeRun and inventoryState instead of local judging code', () => {
    expect(replaySource).toContain('judgeRun(')
    expect(replaySource).toContain('inventoryState(')
    expect(replaySource).not.toMatch(/function\s+(judge|tally)\b/)
  })
})
