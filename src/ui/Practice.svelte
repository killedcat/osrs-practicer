<script lang="ts">
  import { EngineSession, TickClock, judgeRun } from '../engine'
  import type { MethodDefinition, RunLog, RunScore, Verdict, VerdictEvent } from '../engine'
  import { SvelteMap } from 'svelte/reactivity'
  import Scene from './Scene.svelte'

  const FLASH_MS = 250

  interface Props {
    definition: MethodDefinition
  }

  let { definition }: Props = $props()

  type Status = 'idle' | 'running' | 'result'

  let status = $state<Status>('idle')
  let currentTick = $state(0)
  let cyclePosition = $state(0)
  let score = $state<RunScore | undefined>(undefined)
  let flashes = $state<Record<string, Verdict | undefined>>({})

  let session: EngineSession | undefined = undefined
  let clock: TickClock | undefined = undefined
  let unsubscribers: Array<() => void> = []
  const flashTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>()

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
    if (session !== undefined) cyclePosition = session.getCyclePosition()
  }

  function start(): void {
    if (clock === undefined || session === undefined) {
      clock = new TickClock()
      session = new EngineSession(definition, clock)
      unsubscribers.push(session.onVerdict(showVerdictFlash))
      unsubscribers.push(clock.onTick(onClockTick))
    }
    clearFlashTimers()
    flashes = {}
    score = undefined
    status = 'running'
    session.start(1)
    currentTick = 0
    cyclePosition = session.getCyclePosition()
  }

  function stop(): void {
    if (session === undefined || status !== 'running') return
    const log: RunLog = session.stop()
    clearFlashTimers()
    flashes = {}
    score = judgeRun(log, definition).score
    status = 'result'
  }

  function handleTargetClick(targetId: string): void {
    if (status === 'running') session?.input(targetId)
  }

  $effect(() => {
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      unsubscribers = []
      clearFlashTimers()
      session?.stop()
      session = undefined
      clock = undefined
    }
  })
</script>

<section class="practice">
  <p class="description">{definition.description}</p>

  <div class="tick-counter" aria-label="Tick counter">
    <span class="tick-number">{currentTick}</span>
    <span class="cycle">cycle position {cyclePosition} of {definition.cycleLength}</span>
  </div>

  <Scene {definition} {flashes} disabled={status !== 'running'} onTarget={handleTargetClick} />

  <div class="controls">
    <button type="button" onclick={start} disabled={status === 'running'}>Start</button>
    <button type="button" onclick={stop} disabled={status !== 'running'}>Stop</button>
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

  .description {
    margin: 0;
    color: #93a5ba;
    max-width: 640px;
  }

  .tick-counter {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tick-number {
    font-size: 3.2rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .cycle {
    color: #7f92a8;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  .controls {
    display: flex;
    gap: 12px;
  }

  .controls button {
    padding: 10px 30px;
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
