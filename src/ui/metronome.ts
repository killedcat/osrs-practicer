const STORAGE_KEY = 'osrs-metronome-enabled'

const PULSE_HZ = 1100
const PULSE_GAIN = 0.2
const PULSE_ATTACK_SECONDS = 0.004
const PULSE_RELEASE_SECONDS = 0.06
const PULSE_TAIL_SECONDS = 0.01

export interface MetronomeOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined
  createAudioContext?: () => AudioContext
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  if (typeof localStorage === 'undefined') return undefined
  return localStorage
}

function defaultAudioContext(): AudioContext {
  return new AudioContext()
}

function readStoredEnabled(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  if (storage === undefined) return true
  try {
    return storage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function persistEnabled(storage: Pick<Storage, 'setItem'>, enabled: boolean): void {
  try {
    storage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    return
  }
}

function playPulse(context: AudioContext, at: number): void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(PULSE_HZ, at)
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(PULSE_GAIN, at + PULSE_ATTACK_SECONDS)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + PULSE_ATTACK_SECONDS + PULSE_RELEASE_SECONDS)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
  }
  oscillator.start(at)
  oscillator.stop(at + PULSE_ATTACK_SECONDS + PULSE_RELEASE_SECONDS + PULSE_TAIL_SECONDS)
}

export class Metronome {
  private context: AudioContext | undefined
  private enabledValue: boolean
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined
  private readonly createAudioContext: () => AudioContext

  constructor(options: MetronomeOptions = {}) {
    this.storage = options.storage ?? defaultStorage()
    this.createAudioContext = options.createAudioContext ?? defaultAudioContext
    this.enabledValue = readStoredEnabled(this.storage)
  }

  get enabled(): boolean {
    return this.enabledValue
  }

  setEnabled(enabled: boolean): void {
    this.enabledValue = enabled
    if (this.storage !== undefined) persistEnabled(this.storage, enabled)
  }

  ensure(): void {
    if (this.context !== undefined) return
    try {
      this.context = this.createAudioContext()
    } catch {
      this.context = undefined
    }
  }

  pulse(): void {
    if (!this.enabledValue || this.context === undefined) return
    const context = this.context
    if (context.state !== 'running') void context.resume().catch(() => undefined)
    try {
      playPulse(context, context.currentTime)
    } catch {
      return
    }
  }

  dispose(): void {
    const context = this.context
    this.context = undefined
    if (context === undefined) return
    void context.close().catch(() => undefined)
  }
}
