<script lang="ts">
  import { EngineSession, TickClock, judgeRun, inventoryState } from '../engine'
  import type { MethodDefinition, RunLog, RunScore, VerdictEvent } from '../engine'
  import { SvelteMap } from 'svelte/reactivity'
  import { addRun, createHistoryId } from './history'
  import type { HistoryRecord } from './history'
  import { Metronome } from './metronome'
  import ClientShell from './ClientShell.svelte'

  const CLICK_MS = 250

  const RATE_PRESETS: Array<{ label: string; rate: number }> = [
    { label: '1x', rate: 1 },
    { label: '1/2x', rate: 0.5 },
    { label: '1/4x', rate: 0.25 },
  ]
  const RATE_SLIDER_MIN = 0.1
  const RATE_SLIDER_MAX = 1
  const RATE_SLIDER_STEP = 0.05

  const CHAT_BUFFER_MAX = 50

  interface ChatLine {
    text: string
    kind: 'info' | 'good' | 'bad'
  }

  const FLAVOR_PATTERNS: Array<{ pattern: RegExp; line: (label: string) => string }> = [
    { pattern: /\bspot\b/, line: (label) => `You cast out at the ${label}.` },
    { pattern: /\btrap\b/, line: (label) => `You tend the ${label}.` },
    { pattern: /\brock\b/, line: (label) => `You swing your pick at the ${label}.` },
  ]

  interface Props {
    definition: MethodDefinition
    onBack?: () => void
    onReview?: (log: RunLog) => void
    resumeRun?: RunLog
  }

  let { definition, onBack, onReview, resumeRun }: Props = $props()

  type Status = 'idle' | 'running' | 'paused' | 'result'

  interface WastedIndicator {
    mode: 'live' | 'final'
    count: number
  }

  // svelte-ignore state_referenced_locally
  let status = $state<Status>(resumeRun !== undefined ? 'result' : 'idle')
  let currentTick = $state(0)
  let cyclePosition = $state(0)
  let rate = $state(1)
  // svelte-ignore state_referenced_locally
  let score = $state<RunScore | undefined>(
    resumeRun !== undefined ? judgeRun(resumeRun, definition).score : undefined,
  )
  // svelte-ignore state_referenced_locally
  let lastRun = $state<RunLog | undefined>(resumeRun)
  let chat = $state<ChatLine[]>([])
  let clickedTargets = $state<Record<string, boolean>>({})
  // svelte-ignore state_referenced_locally
  let inventoryOccupied = $state(
    resumeRun !== undefined ? inventoryState(resumeRun, definition).occupied : 0,
  )
  let wastedIndicator = $state<WastedIndicator | undefined>(undefined)

  let session: EngineSession | undefined = undefined
  let clock: TickClock | undefined = undefined
  let unsubscribers: Array<() => void> = []
  let startedAt = 0
  let wastedMissedTick: number | undefined = undefined
  const clickedTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>()
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

  function labelOf(targetId: string): string {
    return definition.targets.find((target) => target.id === targetId)?.label ?? targetId
  }

  function flavorLineFor(label: string): string {
    const lower = label.toLowerCase()
    for (const flavor of FLAVOR_PATTERNS) {
      if (flavor.pattern.test(lower)) return flavor.line(lower)
    }
    return `You interact with the ${lower}.`
  }

  function errorLineFor(event: VerdictEvent): string {
    const label = labelOf(event.target).toLowerCase()
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

  function pushChat(line: ChatLine): void {
    chat.push(line)
    if (chat.length > CHAT_BUFFER_MAX) chat.splice(0, chat.length - CHAT_BUFFER_MAX)
  }

  function trackWasted(event: VerdictEvent): void {
    if (!isAnchored || primaryTarget === undefined || event.target !== primaryTarget) return
    if (event.verdict === 'missed') {
      wastedMissedTick = event.tick
      wastedIndicator = { mode: 'live', count: 1 }
      return
    }
    if (wastedIndicator !== undefined && wastedIndicator.mode === 'live') {
      const count = wastedIndicator.count
      wastedIndicator = { mode: 'final', count }
      pushChat({
        text: `Wasted ${count} tick${count === 1 ? '' : 's'}.`,
        kind: 'bad',
      })
    }
  }

  function markClicked(targetId: string): void {
    const pending = clickedTimers.get(targetId)
    if (pending !== undefined) clearTimeout(pending)
    clickedTargets[targetId] = true
    clickedTimers.set(
      targetId,
      setTimeout(() => {
        clickedTimers.delete(targetId)
        delete clickedTargets[targetId]
      }, CLICK_MS),
    )
  }

  function clearClickedTimers(): void {
    for (const timer of clickedTimers.values()) clearTimeout(timer)
    clickedTimers.clear()
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
    if (event.verdict === 'hit') {
      if (isAnchored && event.target === primaryTarget) {
        pushChat({ text: flavorLineFor(labelOf(event.target)), kind: 'good' })
      }
    } else {
      pushChat({ text: errorLineFor(event), kind: 'bad' })
    }
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
    clearClickedTimers()
    clickedTargets = {}
    chat = []
    pushChat({ text: `You begin practicing ${definition.name}.`, kind: 'info' })
    score = undefined
    inventoryOccupied = 0
    wastedIndicator = undefined
    wastedMissedTick = undefined
    startedAt = Date.now()
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
    clearClickedTimers()
    clickedTargets = {}
    wastedIndicator = undefined
    wastedMissedTick = undefined
    lastRun = log
    score = judgeRun(log, definition).score
    const historyRecord: HistoryRecord = {
      id: createHistoryId(),
      definitionId: definition.id,
      methodName: definition.name,
      startedAt,
      durationTicks: log.durationTicks,
      score,
    }
    addRun(historyRecord)
    pushChat({ text: `You finished practicing ${definition.name}.`, kind: 'info' })
    status = 'result'
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

  function review(): void {
    if (onReview === undefined || lastRun === undefined) return
    onReview(lastRun)
  }

  function canClickScene(): boolean {
    return status === 'running' || status === 'paused'
  }

  function isLive(): boolean {
    return status === 'running' || status === 'paused'
  }

  function handleTargetClick(targetId: string): void {
    if (!canClickScene()) return
    markClicked(targetId)
    session?.input(targetId)
    refreshInventory()
  }

  function handleRateInput(event: Event): void {
    const input = event.currentTarget
    if (input instanceof HTMLInputElement) setRate(Number(input.value))
  }

  $effect(() => {
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      unsubscribers = []
      clearClickedTimers()
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

  <div class="client-area">
    <div class="client-frame">
      <ClientShell
        {definition}
        {inventoryOccupied}
        onTarget={handleTargetClick}
        disabled={!canClickScene()}
        chatMessages={chat}
        {clickedTargets}
      />
    </div>

    <aside class="hud" aria-label="Practice HUD">
      <div class="tick-hud panel" aria-label="Tick counter">
        <span class="hud-label">Ticks</span>
        <span class="hud-number" class:paused={status === 'paused'}>{currentTick}</span>
        <span class="hud-cycle">cycle {cyclePosition} of {definition.cycleLength}</span>
        {#if status === 'paused'}
          <span class="hud-badge">PAUSED</span>
        {/if}
      </div>
      {#if wastedIndicator !== undefined}
        <div class="wasted-hud panel" class:final={wastedIndicator.mode === 'final'} role="status">
          wasted: {wastedIndicator.count}
        </div>
      {/if}
    </aside>
  </div>

  <div class="controls-panel panel">
    <div class="controls">
      <button type="button" class="btn" onclick={start} disabled={isLive()}>Start</button>
      <button type="button" class="btn" onclick={togglePause} disabled={!isLive()}>
        {status === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button type="button" class="btn" onclick={stepForward} disabled={!isLive()}>Step</button>
      <button type="button" class="btn" onclick={stop} disabled={!isLive()}>Stop</button>
    </div>

    <div class="tuning">
      <div class="rate-controls" role="group" aria-label="Tick rate">
        <span class="rate-label">Tick rate</span>
        <div class="rate-presets">
          {#each RATE_PRESETS as preset (preset.rate)}
            <button
              type="button"
              class="btn"
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
  </div>

  {#if status === 'result' && score !== undefined}
    <section class="result panel">
      <h2 class="title">Run result</h2>
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
      <div class="result-actions">
        <button type="button" class="btn" onclick={review} disabled={lastRun === undefined}>
          Review run
        </button>
        <button type="button" class="btn" onclick={start}>Restart</button>
      </div>
    </section>
  {/if}
</section>

<style>
  .practice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
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

  .client-area {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    flex-wrap: wrap;
    gap: 16px;
    width: 100%;
  }

  .client-frame {
    flex: 1 1 340px;
    min-width: 0;
  }

  .hud {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 172px;
  }

  .tick-hud {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 10px 12px;
  }

  .hud-label {
    color: var(--text-muted);
    font-size: 0.8rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .hud-number {
    color: var(--title);
    font-size: 2.6rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    text-shadow: 1px 1px 0 var(--bg-deep);
  }

  .hud-number.paused {
    color: var(--accent);
  }

  .hud-cycle {
    color: var(--text-muted);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .hud-badge {
    padding: 2px 12px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--bg-deep);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .wasted-hud {
    padding: 8px 12px;
    border-color: var(--error);
    color: var(--error);
    font-size: 1rem;
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
    animation: wasted-pulse 600ms ease-in-out infinite alternate;
  }

  .wasted-hud.final {
    animation: none;
    opacity: 0.7;
  }

  @keyframes wasted-pulse {
    from {
      opacity: 0.75;
    }
    to {
      opacity: 1;
    }
  }

  .controls-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 14px 24px;
  }

  .controls {
    display: flex;
    gap: 12px;
  }

  .controls .btn {
    padding: 8px 20px;
    font-size: 0.95rem;
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

  .rate-presets .btn {
    padding: 4px 12px;
    font-size: 0.85rem;
  }

  .rate-presets .btn.preset-active {
    border-color: var(--accent);
    color: var(--accent);
  }

  .rate-slider {
    width: 180px;
    accent-color: var(--accent);
    cursor: pointer;
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

  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 32px;
    max-width: min(720px, 100%);
  }

  .result h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .result-actions {
    display: flex;
    gap: 12px;
  }

  .result .btn {
    padding: 8px 24px;
    font-size: 0.95rem;
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
