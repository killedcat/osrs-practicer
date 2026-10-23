<script lang="ts">
  import type { MethodDefinition } from '../engine/types'
  import { allDefinitions } from '../methods'

  interface Props {
    onOpen: (definition: MethodDefinition) => void
  }

  let { onOpen }: Props = $props()
</script>

<section class="catalog">
  <h1>Practice methods</h1>
  <p class="hint">Pick a method to start a practice run.</p>
  <ul class="cards">
    {#each allDefinitions as definition (definition.id)}
      <li>
        <button type="button" class="card" onclick={() => onOpen(definition)}>
          <span class="name">{definition.name}</span>
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

  .catalog h1 {
    margin: 0;
    font-size: 1.6rem;
  }

  .hint {
    margin: 0;
    color: #7f92a8;
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
    border: 1px solid #44505f;
    border-radius: 8px;
    background: #1a2129;
    color: #e8edf3;
    cursor: pointer;
  }

  .card:hover {
    border-color: #8ab4f8;
  }

  .name {
    font-size: 1.15rem;
    font-weight: 700;
  }

  .description {
    color: #93a5ba;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .badge {
    padding: 2px 12px;
    border: 1px solid #44505f;
    border-radius: 999px;
    background: #232c36;
    color: #aab8ca;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .badge.anchored {
    border-color: #f0b429;
    color: #f0b429;
  }
</style>
