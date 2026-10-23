import type { RunScore } from '../engine/types'

const STORAGE_KEY = 'osrs-run-history'
const TREND_LENGTH = 10

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export interface HistoryRecord {
  id: string
  definitionId: string
  methodName: string
  startedAt: number
  durationTicks: number
  score: RunScore
}

export interface MethodStats {
  totalRuns: number
  totalHits: number
  totalWrongTick: number
  totalWrongTarget: number
  totalMissed: number
  totalExtra: number
  totalWastedTicks: number
  bestStreak: number
  accuracy: number
  recentTrend: number[]
}

export function createHistoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function defaultStorage(): StorageLike | undefined {
  if (typeof localStorage === 'undefined') return undefined
  return localStorage
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isScore(value: unknown): value is RunScore {
  if (typeof value !== 'object' || value === null) return false
  const score = value as Record<string, unknown>
  return (
    isFiniteNumber(score.hits) &&
    isFiniteNumber(score.wrongTick) &&
    isFiniteNumber(score.wrongTarget) &&
    isFiniteNumber(score.missed) &&
    isFiniteNumber(score.extra) &&
    isFiniteNumber(score.wastedTicks) &&
    isFiniteNumber(score.longestStreak)
  )
}

function isHistoryRecord(value: unknown): value is HistoryRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.definitionId === 'string' &&
    typeof record.methodName === 'string' &&
    isFiniteNumber(record.startedAt) &&
    isFiniteNumber(record.durationTicks) &&
    isScore(record.score)
  )
}

function persist(records: HistoryRecord[], storage: StorageLike | undefined): void {
  if (storage === undefined) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    return
  }
}

function readRecords(storage: StorageLike | undefined): HistoryRecord[] {
  if (storage === undefined) return []
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return []
  }
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    persist([], storage)
    return []
  }
  if (!Array.isArray(parsed)) {
    persist([], storage)
    return []
  }
  const valid = parsed.filter(isHistoryRecord)
  if (valid.length !== parsed.length) persist(valid, storage)
  return valid
}

export function listHistory(definitionId?: string, storage?: StorageLike): HistoryRecord[] {
  const records = readRecords(storage ?? defaultStorage())
  if (definitionId === undefined) return records
  return records.filter((record) => record.definitionId === definitionId)
}

export function addRun(record: HistoryRecord, storage?: StorageLike): void {
  const stored = storage ?? defaultStorage()
  const records = readRecords(stored)
  persist([record, ...records], stored)
}

export function clearHistory(definitionId?: string, storage?: StorageLike): void {
  const stored = storage ?? defaultStorage()
  if (definitionId === undefined) {
    persist([], stored)
    return
  }
  const remaining = readRecords(stored).filter((record) => record.definitionId !== definitionId)
  persist(remaining, stored)
}

export function runAccuracy(score: RunScore): number {
  const judged = score.hits + score.wrongTick + score.wrongTarget + score.missed + score.extra
  if (judged === 0) return 0
  return score.hits / judged
}

export function getStats(definitionId: string, storage?: StorageLike): MethodStats {
  const records = listHistory(definitionId, storage)
  const stats: MethodStats = {
    totalRuns: records.length,
    totalHits: 0,
    totalWrongTick: 0,
    totalWrongTarget: 0,
    totalMissed: 0,
    totalExtra: 0,
    totalWastedTicks: 0,
    bestStreak: 0,
    accuracy: 0,
    recentTrend: [],
  }
  for (const record of records) {
    const score = record.score
    stats.totalHits += score.hits
    stats.totalWrongTick += score.wrongTick
    stats.totalWrongTarget += score.wrongTarget
    stats.totalMissed += score.missed
    stats.totalExtra += score.extra
    stats.totalWastedTicks += score.wastedTicks
    if (score.longestStreak > stats.bestStreak) stats.bestStreak = score.longestStreak
  }
  const judged =
    stats.totalHits + stats.totalWrongTick + stats.totalWrongTarget + stats.totalMissed + stats.totalExtra
  stats.accuracy = judged === 0 ? 0 : stats.totalHits / judged
  stats.recentTrend = records.slice(0, TREND_LENGTH).map((record) => runAccuracy(record.score)).reverse()
  return stats
}
