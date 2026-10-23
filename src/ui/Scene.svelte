<script lang="ts">
  import type { MethodDefinition, Verdict } from '../engine'

  interface Props {
    definition: MethodDefinition
    flashes: Record<string, Verdict | undefined>
    onTarget?: (targetId: string) => void
    disabled?: boolean
  }

  let { definition, flashes, onTarget, disabled = false }: Props = $props()

  function flashClass(targetId: string): string {
    const verdict = flashes[targetId]
    if (verdict === undefined) return 'flash-none'
    return verdict === 'hit' ? 'flash-hit' : 'flash-bad'
  }
</script>

<div class="scene" role="group" aria-label="Practice scene">
  {#each definition.targets as target (target.id)}
    <button
      class="hotspot {flashClass(target.id)}"
      type="button"
      onclick={() => onTarget?.(target.id)}
      {disabled}
    >
      {target.label}
    </button>
  {/each}
</div>

<style>
  .scene {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
  }

  .hotspot {
    width: 180px;
    height: 128px;
    border: 2px solid #44505f;
    border-radius: 8px;
    background: #1c232c;
    color: #aab8ca;
    font-size: 1rem;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      transform 80ms ease;
  }

  .hotspot:focus-visible {
    outline: 2px solid #8ab4f8;
    outline-offset: 2px;
  }

  .hotspot:hover:enabled {
    border-color: #6d8199;
    transform: translateY(-2px);
  }

  .hotspot:active:enabled {
    transform: translateY(1px);
  }

  .hotspot:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .hotspot.flash-hit {
    background: #1d5c29;
    border-color: #46d16f;
    color: #d9ffe1;
  }

  .hotspot.flash-bad {
    background: #65201f;
    border-color: #ff6b6b;
    color: #ffe0dc;
  }
</style>
