<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity'
  import { TickClock, inventoryState, judgeRun } from '../engine'
  import type { MethodDefinition, RunLog, Verdict } from '../engine'
  import { Metronome } from './metronome'
  import Scene from './Scene.svelte'

  const RATE_PRESETS: Array<{ label: string; rate: number }> = [
    { label: '1x', rate: 1 },
    { label: '1/2x', rate: 0.5 },
    { label: '1/4x', rate: 0.25 },
  ]

  interface Props {
    definition: MethodDefinition
    log: RunLog
    onBack?: () => void
  }

  let { definition, log, onBack }: Props = $props()

  type Playback = 'paused' | 'playing'
  type TimelineCell = 'none' | 'hit' | 'error'

  let tick = $state(0)
  let playback = $state<Playback>('paused')
  let rate = $state(1)

  let clock: TickClock | undefined = undefined
  let playBase = 0
  let unsubscribers: Array<() => void> = []
  const metronome = new Metronome()
  let metronomeOn = $state(metronome.enabled)

  function logThrough(log: RunLog, toTick: number): RunLog {
    return {
      definitionId: log.definitionId,
      inputs: log.inputs.filter((input) => input.tick <= toTick),
      durationTicks: toTick + 1,
    }
  }

  const lastTick = $derived(Math.max(log.durationTicks - 1, 0))
  const judgement = $derived(judgeRun(log, definition))
  const prefixLog = $derived.by(() => logThrough(log, tick))
  const cumulativeScore = $derived(judgeRun(prefixLog, definition).score)
  const inventoryOccupied = $derived(inventoryState(prefixLog, definition).occupied)
  const scoreTitle = $derived(tick >= lastTick ? 'Final score' : `Score through tick ${tick}`)

  const flashes = $derived.by(() => {
    const atTick: Record<string, Verdict | undefined> = {}
    for (const event of judgement.verdicts) {
      if (event.tick !== tick) continue
      atTick[event.target] = event.verdict
    }
    return atTick
  })

  const clickedTargets = $derived.by(() => {
    const clicked = new SvelteSet<string>()
    for (const input of log.inputs) {
      if (input.tick === tick) clicked.add(input.target)
    }
    return clicked
  })

  const wastedBanner = $derived.by(() => {
    if (definition.semantics !== 'anchored') return undefined
    const primary = definition.expectedInputs.find((expected) => expected.primary === true)
    if (primary === undefined) return undefined
    const primaryEvents = judgement.verdicts.filter(
      (event) => event.target === primary.target && event.tick <= tick,
    )
    let missedTick: number | undefined = undefined
    let recoveryTick: number | undefined = undefined
    for (const event of primaryEvents) {
      if (event.verdict === 'missed') {
        missedTick = event.tick
        recoveryTick = undefined
        continue
      }
      if (missedTick !== undefined && recoveryTick === undefined) recoveryTick = event.tick
    }
    if (missedTick === undefined) return undefined
    const length = Math.max(1, definition.cycleLength)
    if (recoveryTick === undefined) {
      const count = Math.min(Math.max(tick - missedTick, 0) + 1, length)
      return { mode: 'live' as const, count }
    }
    return { mode: 'final' as const, count: Math.min(recoveryTick - missedTick, length) }
  })

  const timelineCells = $derived.by(() => {
    const cells: TimelineCell[] = Array.from(
      { length: Math.max(log.durationTicks, 0) },
      () => 'none',
    )
    for (const event of judgement.verdicts) {
      if (event.tick < 0 || event.tick >= cells.length) continue
      if (event.verdict === 'hit') {
        if (cells[event.tick] !== 'error') cells[event.tick] = 'hit'
      } else {
        cells[event.tick] = 'error'
      }
    }
    return cells
  })

  function ensureClock(): TickClock {
    if (clock === undefined) {
      const created = new TickClock()
      unsubscribers.push(created.onTick(handleClockTick))
      unsubscribers.push(created.onTick(() => metronome.pulse()))
      clock = created
    }
    return clock
  }

  function handleClockTick(count: number): void {
    const next = playBase + count
    if (next >= lastTick) {
      tick = lastTick
      pausePlayback()
    } else {
      tick = next
    }
  }

  function play(): void {
    if (lastTick === 0) return
    if (tick >= lastTick) tick = 0
    const active = ensureClock()
    if (metronomeOn) metronome.ensure()
    playBase = tick
    active.start(rate)
    playback = 'playing'
  }

  function pausePlayback(): void {
    clock?.pause()
    playback = 'paused'
  }

  function togglePlayback(): void {
    if (playback === 'playing') pausePlayback()
    else play()
  }

  function scrubTo(next: number): void {
    tick = Math.min(Math.max(next, 0), lastTick)
    if (playback !== 'playing') return
    if (tick >= lastTick) {
      pausePlayback()
      return
    }
    const active = ensureClock()
    playBase = tick
    active.start(rate)
  }

  function nudge(direction: number): void {
    scrubTo(tick + direction)
  }

  function setRate(next: number): void {
    rate = next
    if (clock !== undefined && playback === 'playing') clock.setRate(next)
  }

  function toggleMetronome(): void {
    const next = !metronomeOn
    metronomeOn = next
    metronome.setEnabled(next)
    if (next) metronome.ensure()
  }

  function noopTarget(): void {}

  function handleScrub(event: Event): void {
    const input = event.currentTarget
    if (input instanceof HTMLInputElement) scrubTo(Number(input.value))
  }

  function formatRate(value: number): string {
    return `${Math.round(value * 100) / 100}x`
  }

  $effect(() => {
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      unsubscribers = []
      clock?.pause()
      clock = undefined
      metronome.dispose()
    }
  })
</script>

<section class="replay">
  {#if onBack !== undefined}
    <button type="button" class="back-button" onclick={onBack}>Back to practice</button>
  {/if}

  <p class="description">{definition.description}</p>

  <div class="tick-counter" aria-label="Replay tick">
    <span class="tick-number" class:playing={playback === 'playing'}>{tick}</span>
    <span class="cycle">tick {tick} of {lastTick}</span>
    {#if playback === 'playing'}
      <span class="playing-badge">PLAYING</span>
    {/if}
  </div>

  <Scene
    {definition}
    {flashes}
    inventoryOccupied={inventoryOccupied}
    wastedTicks={wastedBanner}
    disabled={true}
    onTarget={noopTarget}
    clickedTargets={clickedTargets}
  />

  <div class="controls">
    <button type="button" onclick={togglePlayback} disabled={lastTick === 0}>
      {playback === 'playing' ? 'Pause' : 'Play'}
    </button>
    <button type="button" onclick={() => nudge(-1)} disabled={tick === 0}>Prev tick</button>
    <button type="button" onclick={() => nudge(1)} disabled={tick >= lastTick}>Next tick</button>
  </div>

  <div class="tuning">
    <div class="rate-controls" role="group" aria-label="Replay rate">
      <span class="rate-label">Replay rate</span>
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
      <span class="rate-value">{formatRate(rate)}</span>
    </div>

    <label class="metronome">
      <input type="checkbox" checked={metronomeOn} onchange={toggleMetronome} />
      Metronome
    </label>
  </div>

  <input
    type="range"
    class="scrub"
    min={0}
    max={lastTick}
    value={tick}
    oninput={handleScrub}
    aria-label="Scrub to tick"
  />

  <div class="timeline-wrap">
    <span class="timeline-label">Timeline</span>
    <div class="timeline" role="group" aria-label="Verdict timeline">
      {#each timelineCells as cell, index (index)}
        <button
          type="button"
          class="cell"
          class:hit={cell === 'hit'}
          class:error={cell === 'error'}
          class:current={index === tick}
          onclick={() => scrubTo(index)}
          aria-label="Scrub to tick {index}"
        ></button>
      {/each}
    </div>
  </div>

  <section class="score-panel">
    <h2>{scoreTitle}</h2>
    <dl class="score">
      <div class="score-item">
        <dt>hits</dt>
        <dd>{cumulativeScore.hits}</dd>
      </div>
      <div class="score-item">
        <dt>wrong tick</dt>
        <dd>{cumulativeScore.wrongTick}</dd>
      </div>
      <div class="score-item">
        <dt>wrong target</dt>
        <dd>{cumulativeScore.wrongTarget}</dd>
      </div>
      <div class="score-item">
        <dt>missed</dt>
        <dd>{cumulativeScore.missed}</dd>
      </div>
      <div class="score-item">
        <dt>extra</dt>
        <dd>{cumulativeScore.extra}</dd>
      </div>
      <div class="score-item">
        <dt>wasted ticks</dt>
        <dd>{cumulativeScore.wastedTicks}</dd>
      </div>
    </dl>
  </section>
</section>

<style>
  .replay {
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
    border: 1px solid var(--stone-dark);
    background: var(--stone);
    color: var(--text-muted);
    cursor: pointer;
  }

  .back-button:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .description {
    margin: 0;
    color: var(--text-muted);
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

  .tick-number.playing {
    color: var(--success);
  }

  .cycle {
    color: var(--text-muted);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  .playing-badge {
    padding: 2px 14px;
    border-radius: 999px;
    background: var(--success);
    color: var(--bg-deep);
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
    border: 1px solid var(--stone-dark);
    background: var(--stone);
    color: var(--text);
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
    color: var(--text-muted);
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
    border: 1px solid var(--stone-dark);
    background: var(--stone);
    color: var(--text);
    cursor: pointer;
  }

  .rate-controls button.preset-active {
    border-color: var(--accent);
    color: var(--accent);
  }

  .rate-value {
    min-width: 52px;
    color: var(--accent);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .metronome {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 0.95rem;
    cursor: pointer;
  }

  .metronome input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .scrub {
    width: min(560px, 90vw);
    accent-color: var(--accent);
    cursor: pointer;
  }

  .timeline-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .timeline-label {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .timeline {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    justify-content: center;
    max-width: 640px;
  }

  .cell {
    width: 18px;
    height: 18px;
    padding: 0;
    border-radius: 4px;
    border: 1px solid var(--stone-dark);
    background: var(--stone);
    cursor: pointer;
  }

  .cell.hit {
    background: var(--success-dim);
    border-color: var(--success);
  }

  .cell.error {
    background: var(--error-dim);
    border-color: var(--error);
  }

  .cell.current {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .score-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 32px;
    border: 1px solid var(--stone-dark);
    border-radius: 8px;
    background: var(--bg-deep);
  }

  .score-panel h2 {
    margin: 0;
    font-size: 1.2rem;
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
    color: var(--text-muted);
  }

  .score-item dd {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
