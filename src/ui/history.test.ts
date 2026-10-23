import { describe, expect, it } from 'vitest'
import type { RunScore } from '../engine'
import { addRun, clearHistory, createHistoryId, getStats, listHistory } from './history'
import type { HistoryRecord, StorageLike } from './history'

const KEY = 'osrs-run-history'
const TREND_LENGTH = 10

function fakeStorage(values: Map<string, string> = new Map()): StorageLike {
  return {
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, value)
    },
  }
}

function score(overrides: Partial<RunScore> = {}): RunScore {
  return {
    hits: 0,
    wrongTick: 0,
    wrongTarget: 0,
    missed: 0,
    extra: 0,
    wastedTicks: 0,
    longestStreak: 0,
    ...overrides,
  }
}

function record(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    id: 'run-1',
    definitionId: '1t-chinchompas',
    methodName: '1-Tick Chinchompas',
    startedAt: 1_000,
    durationTicks: 10,
    score: score(),
    ...overrides,
  }
}

describe('history storage', () => {
  it('returns an empty list when nothing is stored or storage is unavailable', () => {
    expect(listHistory(undefined, fakeStorage())).toEqual([])
    expect(listHistory(undefined, undefined)).toEqual([])
    expect(getStats('1t-chinchompas', fakeStorage()).totalRuns).toBe(0)
  })

  it('persists runs and lists them newest first, filtered when an id is given', () => {
    const storage = fakeStorage()
    const older = record({ id: 'a', startedAt: 1_000 })
    const newer = record({ id: 'b', startedAt: 2_000, definitionId: '3t-fishing' })
    addRun(older, storage)
    addRun(newer, storage)

    expect(listHistory(undefined, storage).map((entry) => entry.id)).toEqual(['b', 'a'])
    expect(listHistory('3t-fishing', storage).map((entry) => entry.id)).toEqual(['b'])
    expect(listHistory('missing', storage)).toEqual([])
  })

  it('stores a single JSON array under the shared key', () => {
    const storage = fakeStorage()
    addRun(record(), storage)
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '')
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toEqual([record()])
  })

  it('resets corrupt JSON and non-array payloads to empty', () => {
    const corrupt = fakeStorage(new Map([[KEY, '{not json']]))
    expect(listHistory(undefined, corrupt)).toEqual([])
    expect(corrupt.getItem(KEY)).toBe('[]')

    const notAnArray = fakeStorage(new Map([[KEY, '{"id": "x"}']]))
    expect(listHistory(undefined, notAnArray)).toEqual([])
    expect(notAnArray.getItem(KEY)).toBe('[]')
  })

  it('drops malformed entries and keeps the valid ones', () => {
    const malformed = [42, record({ id: 'good' }), { id: 'half' }]
    const storage = fakeStorage(new Map([[KEY, JSON.stringify(malformed)]]))

    expect(listHistory(undefined, storage)).toEqual([record({ id: 'good' })])
    expect(JSON.parse(storage.getItem(KEY) ?? '[]')).toEqual([record({ id: 'good' })])
  })

  it('clears all history, or only one method when an id is given', () => {
    const storage = fakeStorage()
    addRun(record({ id: 'a', definitionId: '1t-chinchompas' }), storage)
    addRun(record({ id: 'b', definitionId: '3t-fishing' }), storage)

    clearHistory('1t-chinchompas', storage)
    expect(listHistory(undefined, storage).map((entry) => entry.id)).toEqual(['b'])

    clearHistory(undefined, storage)
    expect(listHistory(undefined, storage)).toEqual([])
  })

  it('survives a failing storage write when adding runs', () => {
    const storage: StorageLike = {
      getItem: (): string | null => null,
      setItem: (): void => {
        throw new Error('quota exceeded')
      },
    }
    expect(() => addRun(record(), storage)).not.toThrow()
    expect(() => clearHistory(undefined, storage)).not.toThrow()
  })
})

describe('method stats', () => {
  it('aggregates verdict counts and takes the best longest streak', () => {
    const storage = fakeStorage()
    addRun(
      record({
        id: 'a',
        score: score({ hits: 4, wrongTick: 2, missed: 1, wastedTicks: 3, longestStreak: 4 }),
      }),
      storage,
    )
    addRun(
      record({
        id: 'b',
        score: score({ hits: 10, wrongTarget: 1, extra: 1, wastedTicks: 0, longestStreak: 6 }),
      }),
      storage,
    )

    const stats = getStats('1t-chinchompas', storage)
    expect(stats.totalRuns).toBe(2)
    expect(stats.totalHits).toBe(14)
    expect(stats.totalWrongTick).toBe(2)
    expect(stats.totalWrongTarget).toBe(1)
    expect(stats.totalMissed).toBe(1)
    expect(stats.totalExtra).toBe(1)
    expect(stats.totalWastedTicks).toBe(3)
    expect(stats.bestStreak).toBe(6)
  })

  it('computes accuracy as hits over all judged events, 0 when there are none', () => {
    const storage = fakeStorage()
    addRun(record({ id: 'a', score: score({ hits: 7, wrongTick: 3 }) }), storage)
    addRun(record({ id: 'b', score: score() }), storage)

    const stats = getStats('1t-chinchompas', storage)
    expect(stats.totalHits).toBe(7)
    expect(stats.totalWrongTick).toBe(3)
    expect(stats.totalMissed).toBe(0)
    expect(stats.totalExtra).toBe(0)
    expect(stats.accuracy).toBeCloseTo(7 / 10)

    const empty = getStats('1t-chinchompas', fakeStorage())
    expect(empty.accuracy).toBe(0)
    expect(empty.recentTrend).toEqual([])
  })

  it('caps recentTrend at the last 10 runs in chronological order', () => {
    const storage = fakeStorage()
    for (let index = 0; index < TREND_LENGTH + 4; index++) {
      addRun(
        record({ id: `run-${index}`, startedAt: index, score: score({ hits: 1, extra: index }) }),
        storage,
      )
    }

    const expected = Array.from({ length: TREND_LENGTH }, (_, index) => 1 / (index + 5))
    expect(getStats('1t-chinchompas', storage).recentTrend).toEqual(expected)
  })
})

describe('createHistoryId', () => {
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createHistoryId()))
    expect(ids.size).toBe(50)
  })
})
