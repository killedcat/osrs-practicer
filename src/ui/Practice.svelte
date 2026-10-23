<script lang="ts">
  import { EngineSession, TickClock, judgeRun, inventoryState } from '../engine'
  import type { MethodDefinition, RunLog, RunScore, Verdict, VerdictEvent } from '../engine'
  import { SvelteMap } from 'svelte/reactivity'
  import { Metronome } from './metronome'
  import Scene from './Scene.svelte'

  const FLASH_MS = 250

  const RATE_PRESETS: Array<{ label: string; rate: number }> = [
    { label: '1x', rate: 1 },
    { label: '1/2x', rate: 0.5 },
    { label: '1/4x', rate: 0.25 },
  ]
  const RATE_SLIDER_MIN = 0.1
  const RATE_SLIDER_MAX = 1
  const RATE_SLIDER_STEP = 0.05

  interface Props {
    definition: MethodDefinition
    onBack?: () => void
  }

  let { definition, onBack }: Props = $props()

  type Status = 'idle' | 'running' | 'paused' | 'result'

  interface WastedIndicator {
    mode: 'live' | 'final'
    count: number
  }

  let status = $state<Status>('idle')
  let currentTick = $state(0)
  let cyclePosition = $state(0)
  let rate = $state(1)
  let score = $state<RunScore | undefined>(undefined)
  let flashes = $state<Record<string, Verdict | undefined>>({})
  let inventoryOccupied = $state(0)
  let wastedIndicator = $state<WastedIndicator | undefined>(undefined)

  let session: EngineSession | undefined = undefined
  let clock: TickClock | undefined = undefined
  let unsubscribers: Array<() => void> = []
  let wastedMissedTick: number | undefined = undefined
  const flashTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>()
  const metronome = new Metronome()

  let metronomeOn = $state(metronome.enabled)

  const primaryTarget = $derived(
    definition.expectedInputs.find((expected) => expected.primary === true)?.target,
  )
  const isAnchored = $derived(definition.semantics === 'anchored')

  function refreshInventory(): void {
    if (session === undefined) return
    inventoryOccupied = inventoryState(session.getLog(), definition).occupied
  }

  function trackWasted(event: VerdictEvent): void {
    if (!isAnchored || primaryTarget === undefined || event.target !== primaryTarget) return
    if (event.verdict === 'missed') {
      wastedMissedTick = event.tick
      wastedIndicator = { mode: 'live', count: 1 }
      return
    }
    if (wastedIndicator !== undefined && wastedIndicator.mode === 'live') {
      wastedIndicator = { mode: 'final', count: wastedIndicator.count }
    }
  }

  function updateWastedCount(tick: number): void {
    if (
      wastedIndicator === undefined ||
      wastedIndicator.mode !== 'live' ||
      wastedMissedTick === undefined
    ) {
      return
    }
    const count = Math.min(Math.max(tick - wastedMissedTick, 0) + 1, definition.cycleLength)
    wastedIndicator = { mode: 'live', count }
  }

  function showVerdictFlash(event: VerdictEvent): void {
    const pending = flashTimers.get(event.target)
    if (pending !== undefined) clearTimeout(pending)
    flashes[event.target] = event.verdict
    flashTimers.set(
      event.target,
      setTimeout(() => {
        flashTimers.delete(event.target)
        delete flashes[event.target]
      }, FLASH_MS),
    )
  }

  function clearFlashTimers(): void {
    for (const timer of flashTimers.values()) clearTimeout(timer)
    flashTimers.clear()
  }

  function onClockTick(tick: number): void {
    currentTick = tick
    if (session !== undefined) {
      cyclePosition = session.getCyclePosition()
      refreshInventory()
    }
  }

  function formatRate(value: number): string {
    return `${Math.round(value * 100) / 100}x`
  }

  function setRate(next: number): void {
    rate = next
    if (clock === undefined) return
    if (status === 'running') {
      clock.setRate(next)
    } else if (status === 'paused' && clock.isPaused) {
      clock.resume()
      clock.setRate(next)
      clock.pause()
    }
  }

  function toggleMetronome(): void {
    const next = !metronomeOn
    metronomeOn = next
    metronome.setEnabled(next)
    if (next) metronome.ensure()
  }

  function handleVerdict(event: VerdictEvent): void {
    showVerdictFlash(event)
    trackWasted(event)
  }

  function start(): void {
    if (clock === undefined || session === undefined) {
      clock = new TickClock()
      session = new EngineSession(definition, clock)
      unsubscribers.push(session.onVerdict(handleVerdict))
      unsubscribers.push(clock.onTick(onClockTick))
      unsubscribers.push(clock.onCommit(updateWastedCount))
      unsubscribers.push(clock.onTick(() => metronome.pulse()))
    }
    if (metronomeOn) metronome.ensure()
    clearFlashTimers()
    flashes = {}
    score = undefined
    inventoryOccupied = 0
    wastedIndicator = undefined
    wastedMissedTick = undefined
    status = 'running'
    session.start(rate)
    currentTick = 0
    cyclePosition = session.getCyclePosition()
  }

  function togglePause(): void {
    if (status === 'running') {
      session?.pause()
      status = 'paused'
    } else if (status === 'paused') {
      session?.resume()
      status = 'running'
    }
  }

  function stepForward(): void {
    if (session === undefined) return
    if (status === 'running') {
      session.pause()
      status = 'paused'
    }
    if (status !== 'paused') return
    session.step()
  }

  function stop(): void {
    if (session === undefined || (status !== 'running' && status !== 'paused')) return
    const log: RunLog = session.stop()
    clearFlashTimers()
    flashes = {}
    wastedIndicator = undefined
    wastedMissedTick = undefined
    score = judgeRun(log, definition).score
    status = 'result'
  }

  function canClickScene(): boolean {
    return status === 'running' || status === 'paused'
  }

  function isLive(): boolean {
    return status === 'running' || status === 'paused'
  }

  function handleTargetClick(targetId: string): void {
    if (canClickScene()) {
      session?.input(targetId)
      refreshInventory()
    }
  }

  function handleRateInput(event: Event): void {
    const input = event.currentTarget
    if (input instanceof HTMLInputElement) setRate(Number(input.value))
  }

  $effect(() => {
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      unsubscribers = []
      clearFlashTimers()
      session?.stop()
      session = undefined
      clock = undefined
      metronome.dispose()
    }
  })
</script>

<section class="practice">
  {#if onBack !== undefined}
    <button type="button" class="back-button" onclick={onBack}>Back to catalog</button>
  {/if}

  <p class="description">{definition.description}</p>

  <div class="tick-counter" aria-label="Tick counter">
    <span class="tick-number" class:paused={status === 'paused'}>{currentTick}</span>
    <span class="cycle">cycle position {cyclePosition} of {definition.cycleLength}</span>
    {#if status === 'paused'}
      <span class="paused-badge">PAUSED</span>
    {/if}
  </div>

  <Scene
    {definition}
    {flashes}
    inventoryOccupied={inventoryOccupied}
    wastedTicks={wastedIndicator}
    disabled={!canClickScene()}
    onTarget={handleTargetClick}
  />

  <div class="controls">
    <button type="button" onclick={start} disabled={isLive()}>Start</button>
    <button type="button" onclick={togglePause} disabled={!isLive()}>
      {status === 'paused' ? 'Resume' : 'Pause'}
    </button>
    <button type="button" onclick={stepForward} disabled={!isLive()}>Step</button>
    <button type="button" onclick={stop} disabled={!isLive()}>Stop</button>
  </div>

  <div class="tuning">
    <div class="rate-controls" role="group" aria-label="Tick rate">
      <span class="rate-label">Tick rate</span>
      <div class="rate-presets">
        {#each RATE_PRESETS as preset (preset.rate)}
          <button
            type="button"
            class:preset-active={rate === preset.rate}
            onclick={() => setRate(preset.rate)}
          >
            {preset.label}
          </button>
        {/each}
      </div>
      <input
        type="range"
        class="rate-slider"
        min={RATE_SLIDER_MIN}
        max={RATE_SLIDER_MAX}
        step={RATE_SLIDER_STEP}
        value={rate}
        oninput={handleRateInput}
        aria-label="Fine tick rate"
      />
      <span class="rate-value">{formatRate(rate)}</span>
    </div>

    <label class="metronome">
      <input type="checkbox" checked={metronomeOn} onchange={toggleMetronome} />
      Metronome
    </label>
  </div>

  {#if status === 'result' && score !== undefined}
    <section class="result">
      <h2>Run result</h2>
      <dl class="score">
        <div class="score-item">
          <dt>hits</dt>
          <dd>{score.hits}</dd>
        </div>
        <div class="score-item">
          <dt>wrong tick</dt>
          <dd>{score.wrongTick}</dd>
        </div>
        <div class="score-item">
          <dt>wrong target</dt>
          <dd>{score.wrongTarget}</dd>
        </div>
        <div class="score-item">
          <dt>missed</dt>
          <dd>{score.missed}</dd>
        </div>
        <div class="score-item">
          <dt>extra</dt>
          <dd>{score.extra}</dd>
        </div>
        <div class="score-item">
          <dt>wasted ticks</dt>
          <dd>{score.wastedTicks}</dd>
        </div>
      </dl>
      <button type="button" onclick={start}>Restart</button>
    </section>
  {/if}
</section>

<style>
  .practice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .back-button {
    align-self: flex-start;
    padding: 6px 16px;
    font-size: 0.9rem;
    border-radius: 6px;
    border: 1px solid #44505f;
    background: #232c36;
    color: #aab8ca;
    cursor: pointer;
  }

  .back-button:hover {
    border-color: #8ab4f8;
    color: #8ab4f8;
  }

  .description {
    margin: 0;
    color: #93a5ba;
    max-width: 640px;
  }

  .tick-counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .tick-number {
    font-size: 3.2rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .tick-number.paused {
    color: #f0b429;
  }

  .cycle {
    color: #7f92a8;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  .paused-badge {
    padding: 2px 14px;
    border-radius: 999px;
    background: #f0b429;
    color: #1a2129;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .controls {
    display: flex;
    gap: 12px;
  }

  .controls button {
    padding: 10px 24px;
    font-size: 1rem;
    border-radius: 6px;
    border: 1px solid #44505f;
    background: #232c36;
    color: #e8edf3;
    cursor: pointer;
  }

  .controls button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .tuning {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .rate-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rate-label {
    color: #7f92a8;
    font-size: 0.9rem;
  }

  .rate-presets {
    display: flex;
    gap: 6px;
  }

  .rate-controls button {
    padding: 6px 14px;
    font-size: 0.9rem;
    border-radius: 6px;
    border: 1px solid #44505f;
    background: #232c36;
    color: #e8edf3;
    cursor: pointer;
  }

  .rate-controls button.preset-active {
    border-color: #8ab4f8;
    color: #8ab4f8;
  }

  .rate-slider {
    width: 180px;
    accent-color: #8ab4f8;
    cursor: pointer;
  }

  .rate-value {
    min-width: 52px;
    color: #8ab4f8;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .metronome {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #aab8ca;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .metronome input {
    width: 16px;
    height: 16px;
    accent-color: #8ab4f8;
    cursor: pointer;
  }

  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 32px;
    border: 1px solid #44505f;
    border-radius: 8px;
    background: #1a2129;
  }

  .result h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .result button {
    padding: 8px 24px;
    font-size: 0.95rem;
    border-radius: 6px;
    border: 1px solid #44505f;
    background: #232c36;
    color: #e8edf3;
    cursor: pointer;
  }

  .score {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
    justify-content: center;
    margin: 0;
  }

  .score-item {
    min-width: 88px;
  }

  .score-item dt {
    font-size: 0.8rem;
    color: #7f92a8;
  }

  .score-item dd {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
