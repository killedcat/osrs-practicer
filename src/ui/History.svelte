<script lang="ts">
  import type { MethodDefinition } from '../engine'
  import { allDefinitions } from '../methods'
  import { clearHistory, getStats, listHistory } from './history'
  import type { MethodStats } from './history'

  interface Props {
    onBack?: () => void
  }

  let { onBack }: Props = $props()

  let revision = $state(0)

  interface MethodSection {
    definition: MethodDefinition
    stats: MethodStats
  }

  function hasRuns(): boolean {
    return listHistory().length > 0
  }

  function collectSections(): MethodSection[] {
    return allDefinitions
      .map((definition) => ({ definition, stats: getStats(definition.id) }))
      .filter((section) => section.stats.totalRuns > 0)
  }

  const anyRuns = $derived.by(() => {
    void revision
    return hasRuns()
  })

  const sections = $derived.by(() => {
    void revision
    return collectSections()
  })

  function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`
  }

  function refresh(): void {
    revision += 1
  }

  function clearAll(): void {
    if (!window.confirm('Clear all run history? This cannot be undone.')) return
    clearHistory()
    refresh()
  }

  function clearMethod(definition: MethodDefinition): void {
    if (!window.confirm(`Clear all runs for ${definition.name}? This cannot be undone.`)) return
    clearHistory(definition.id)
    refresh()
  }
</script>

<section class="history">
  <div class="header">
    {#if onBack !== undefined}
      <button type="button" class="back-button" onclick={onBack}>Back to catalog</button>
    {/if}
    <h1>Run history</h1>
    <button type="button" class="danger" onclick={clearAll} disabled={!anyRuns}>
      Clear all history
    </button>
  </div>

  {#if !anyRuns}
    <p class="empty">No runs recorded yet. Finish a practice run to see your stats here.</p>
  {:else}
    {#each sections as section (section.definition.id)}
      <article class="method">
        <div class="method-header">
          <h2>{section.definition.name}</h2>
          <button type="button" class="danger small" onclick={() => clearMethod(section.definition)}>
            Clear history
          </button>
        </div>
        <dl class="summary">
          <div class="stat">
            <dt>total runs</dt>
            <dd>{section.stats.totalRuns}</dd>
          </div>
          <div class="stat">
            <dt>accuracy</dt>
            <dd>{formatPercent(section.stats.accuracy)}</dd>
          </div>
          <div class="stat">
            <dt>best streak</dt>
            <dd>{section.stats.bestStreak}</dd>
          </div>
        </dl>
        <dl class="verdicts">
          <div class="stat">
            <dt>hits</dt>
            <dd>{section.stats.totalHits}</dd>
          </div>
          <div class="stat">
            <dt>wrong tick</dt>
            <dd>{section.stats.totalWrongTick}</dd>
          </div>
          <div class="stat">
            <dt>wrong target</dt>
            <dd>{section.stats.totalWrongTarget}</dd>
          </div>
          <div class="stat">
            <dt>missed</dt>
            <dd>{section.stats.totalMissed}</dd>
          </div>
          <div class="stat">
            <dt>extra</dt>
            <dd>{section.stats.totalExtra}</dd>
          </div>
          <div class="stat">
            <dt>wasted ticks</dt>
            <dd>{section.stats.totalWastedTicks}</dd>
          </div>
        </dl>
        <div class="trend-wrap">
          <span class="trend-label">Recent accuracy (last 10 runs)</span>
          <div
            class="trend"
            role="img"
            aria-label="Accuracy of the last {section.stats.recentTrend.length} runs: {section.stats
              .recentTrend.map(formatPercent)
              .join(', ')}"
          >
            {#each section.stats.recentTrend as accuracy, index (index)}
              <div class="trend-cell">
                <div
                  class="trend-bar"
                  class:good={accuracy >= 0.8}
                  class:mixed={accuracy >= 0.5 && accuracy < 0.8}
                  class:poor={accuracy < 0.5}
                  style:height="{Math.round(accuracy * 100)}%"
                  title={formatPercent(accuracy)}
                ></div>
              </div>
            {/each}
          </div>
        </div>
      </article>
    {/each}
  {/if}
</section>

<style>
  .history {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: min(640px, 100%);
  }

  .header h1 {
    margin: 0;
    font-size: 1.6rem;
  }

  .back-button {
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

  .danger {
    padding: 6px 16px;
    font-size: 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--error-dim);
    background: var(--stone);
    color: var(--error);
    cursor: pointer;
  }

  .danger:hover:not(:disabled) {
    border-color: var(--error);
  }

  .danger:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .danger.small {
    padding: 4px 12px;
    font-size: 0.85rem;
  }

  .empty {
    margin: 0;
    color: var(--text-muted);
  }

  .method {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: min(640px, 100%);
    padding: 18px 22px;
    border: 1px solid var(--stone-dark);
    border-radius: 8px;
    background: var(--bg-deep);
  }

  .method-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
  }

  .method-header h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .summary,
  .verdicts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
    justify-content: center;
    margin: 0;
  }

  .stat {
    min-width: 72px;
    text-align: center;
  }

  .stat dt {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .stat dd {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .trend-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .trend-label {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .trend {
    display: flex;
    align-items: flex-end;
    gap: 4px;
  }

  .trend-cell {
    display: flex;
    align-items: flex-end;
    width: 22px;
    height: 40px;
    padding: 2px;
    border: 1px solid var(--stone-dark);
    border-radius: 4px;
    background: var(--stone);
  }

  .trend-bar {
    width: 100%;
    min-height: 0;
    border-radius: 2px;
    background: var(--accent);
  }

  .trend-bar.good {
    background: var(--success);
  }

  .trend-bar.mixed {
    background: var(--accent);
  }

  .trend-bar.poor {
    background: var(--error);
  }
</style>
