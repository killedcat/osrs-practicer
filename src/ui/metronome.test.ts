import { describe, expect, it } from 'vitest'
import { Metronome } from './metronome'

interface ParamCall {
  method: string
  args: number[]
}

interface NodeRecord {
  params: ParamCall[]
  connectTargets: unknown[]
  disconnected: number
  starts: number[]
  stops: number[]
  type: OscillatorType
  ended: (() => void) | null
}

interface RecordedNode<T> {
  node: T
  record: NodeRecord
}

interface FakeContext {
  context: AudioContext
  destination: { kind: string }
  oscillators: Array<RecordedNode<OscillatorNode>>
  gains: Array<RecordedNode<GainNode>>
  resumesUsed: () => number
}

const STORAGE_KEY = 'osrs-metronome-enabled'
const PULSE_HZ = 1100
const PULSE_GAIN = 0.2

function fakeParam(): { param: AudioParam; calls: ParamCall[] } {
  const calls: ParamCall[] = []
  const param = {
    value: 0,
    setValueAtTime: (value: number, time: number) => {
      calls.push({ method: 'setValueAtTime', args: [value, time] })
    },
    linearRampToValueAtTime: (value: number, time: number) => {
      calls.push({ method: 'linearRampToValueAtTime', args: [value, time] })
    },
    exponentialRampToValueAtTime: (value: number, time: number) => {
      calls.push({ method: 'exponentialRampToValueAtTime', args: [value, time] })
    },
  }
  return { param: param as unknown as AudioParam, calls }
}

function fakeOscillator(): RecordedNode<OscillatorNode> {
  const { param, calls } = fakeParam()
  const record: NodeRecord = {
    params: calls,
    connectTargets: [],
    disconnected: 0,
    starts: [],
    stops: [],
    type: 'sine',
    ended: null,
  }
  const node = {
    frequency: param,
    start: (time?: number) => {
      record.starts.push(time ?? 0)
    },
    stop: (time?: number) => {
      record.stops.push(time ?? 0)
    },
    connect: (target: unknown) => {
      record.connectTargets.push(target)
      return target
    },
    disconnect: () => {
      record.disconnected += 1
    },
  }
  Object.defineProperty(node, 'type', {
    get: () => record.type,
    set: (value: OscillatorType) => {
      record.type = value
    },
  })
  Object.defineProperty(node, 'onended', {
    get: () => record.ended,
    set: (handler: unknown) => {
      record.ended = (handler as () => void) ?? null
    },
  })
  return { node: node as unknown as OscillatorNode, record }
}

function fakeGain(): RecordedNode<GainNode> {
  const { param, calls } = fakeParam()
  const record: NodeRecord = {
    params: calls,
    connectTargets: [],
    disconnected: 0,
    starts: [],
    stops: [],
    type: 'sine',
    ended: null,
  }
  const node = {
    gain: param,
    connect: (target: unknown) => {
      record.connectTargets.push(target)
      return target
    },
    disconnect: () => {
      record.disconnected += 1
    },
  }
  return { node: node as unknown as GainNode, record }
}

function fakeAudioContext(currentTime = 2.5, state = 'running'): FakeContext {
  const oscillators: Array<RecordedNode<OscillatorNode>> = []
  const gains: Array<RecordedNode<GainNode>> = []
  let resumes = 0
  const destination = { kind: 'destination' }
  const context = {
    currentTime,
    state,
    destination,
    resume: (): Promise<void> => {
      resumes += 1
      return Promise.resolve()
    },
    close: (): Promise<void> => Promise.resolve(),
    createOscillator: (): OscillatorNode => {
      const made = fakeOscillator()
      oscillators.push(made)
      return made.node
    },
    createGain: (): GainNode => {
      const made = fakeGain()
      gains.push(made)
      return made.node
    },
  }
  return {
    context: context as unknown as AudioContext,
    destination,
    oscillators,
    gains,
    resumesUsed: () => resumes,
  }
}

function fakeStorage(
  values: Map<string, string> = new Map(),
): Pick<Storage, 'getItem' | 'setItem'> {
  return {
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, value)
    },
  }
}

describe('Metronome', () => {
  it('is enabled by default and schedules a square pulse per pulse() call', () => {
    const fake = fakeAudioContext()
    const metronome = new Metronome({
      storage: fakeStorage(),
      createAudioContext: () => fake.context,
    })

    expect(metronome.enabled).toBe(true)

    metronome.pulse()
    expect(fake.oscillators).toEqual([])

    metronome.ensure()
    metronome.pulse()

    expect(fake.oscillators).toHaveLength(1)
    const osc = fake.oscillators[0]
    expect(osc.record.type).toBe('square')
    expect(osc.record.params).toEqual([{ method: 'setValueAtTime', args: [PULSE_HZ, 2.5] }])
    expect(osc.record.starts).toEqual([2.5])
    expect(osc.record.stops).toEqual([2.574])
    expect(fake.gains[0].record.params).toEqual([
      { method: 'setValueAtTime', args: [0, 2.5] },
      { method: 'linearRampToValueAtTime', args: [PULSE_GAIN, 2.504] },
      { method: 'exponentialRampToValueAtTime', args: [0.0001, 2.564] },
    ])
    expect(osc.record.connectTargets[0]).toBe(fake.gains[0].node)
    expect(fake.gains[0].record.connectTargets[0]).toBe(fake.destination)

    osc.record.ended?.()
    expect(osc.record.disconnected).toBe(1)
    expect(fake.gains[0].record.disconnected).toBe(1)
  })

  it('does nothing while disabled and persists the disabled choice', () => {
    const stored = new Map<string, string>()
    const fake = fakeAudioContext()
    const metronome = new Metronome({
      storage: fakeStorage(stored),
      createAudioContext: () => fake.context,
    })

    metronome.setEnabled(false)

    expect(metronome.enabled).toBe(false)
    expect(stored.get(STORAGE_KEY)).toBe('false')

    metronome.ensure()
    metronome.pulse()
    expect(fake.oscillators).toEqual([])

    const reloaded = new Metronome({ storage: fakeStorage(stored) })
    expect(reloaded.enabled).toBe(false)
  })

  it('persists re-enabling and pulses again', () => {
    const stored = new Map<string, string>([[STORAGE_KEY, 'false']])
    const fake = fakeAudioContext()
    const metronome = new Metronome({
      storage: fakeStorage(stored),
      createAudioContext: () => fake.context,
    })

    expect(metronome.enabled).toBe(false)

    metronome.setEnabled(true)
    expect(stored.get(STORAGE_KEY)).toBe('true')

    metronome.ensure()
    metronome.pulse()
    expect(fake.oscillators).toHaveLength(1)
  })

  it('creates its context once and resumes a suspended context before pulsing', () => {
    let created = 0
    const fake = fakeAudioContext()
    const metronome = new Metronome({
      storage: fakeStorage(),
      createAudioContext: () => {
        created += 1
        return fake.context
      },
    })

    metronome.ensure()
    metronome.ensure()
    metronome.pulse()

    expect(created).toBe(1)
    expect(fake.resumesUsed()).toBe(0)
    expect(fake.oscillators).toHaveLength(1)

    const suspended = fakeAudioContext(2.5, 'suspended')
    const suspendedMetronome = new Metronome({
      storage: fakeStorage(),
      createAudioContext: () => suspended.context,
    })
    suspendedMetronome.ensure()
    suspendedMetronome.pulse()

    expect(suspended.resumesUsed()).toBe(1)
    expect(suspended.oscillators).toHaveLength(1)
  })
})
