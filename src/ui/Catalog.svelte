<script lang="ts">
  import type { MethodDefinition } from '../engine/types'
  import { allDefinitions } from '../methods'

  interface Props {
    onOpen: (definition: MethodDefinition) => void
    onHistory?: () => void
  }

  let { onOpen, onHistory }: Props = $props()
</script>

<section class="catalog">
  <div class="header">
    <h1 class="title">Practice methods</h1>
    {#if onHistory !== undefined}
      <button type="button" class="btn history-button" onclick={onHistory}>History</button>
    {/if}
  </div>
  <p class="hint">Pick a method to start a practice run.</p>
  <ul class="cards">
    {#each allDefinitions as definition (definition.id)}
      <li>
        <button type="button" class="card panel" onclick={() => onOpen(definition)}>
          <span class="name title">{definition.name}</span>
          <span class="description">{definition.description}</span>
          <span class="badges">
            <span class="badge" class:anchored={definition.semantics === 'anchored'}>
              {definition.semantics}
            </span>
            <span class="badge">
              cycle: {definition.cycleLength} tick{definition.cycleLength === 1 ? '' : 's'}
            </span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .catalog {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: min(640px, 100%);
  }

  .catalog h1 {
    margin: 0;
    font-size: 1.6rem;
  }

  .history-button {
    padding: 6px 16px;
    font-size: 0.9rem;
  }

  .hint {
    margin: 0;
    color: var(--text-muted);
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(640px, 100%);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 18px 22px;
    text-align: center;
    color: var(--text);
    cursor: pointer;
    transition: filter 100ms ease;
  }

  .card:hover {
    filter: brightness(1.18);
  }

  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .name {
    font-size: 1.15rem;
  }

  .description {
    color: var(--text-muted);
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .badge {
    padding: 2px 12px;
    border: 1px solid var(--stone-dark);
    border-radius: 999px;
    background: var(--stone);
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .badge.anchored {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
