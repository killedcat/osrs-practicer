<script lang="ts">
  import { INVENTORY_CAPACITY } from '../engine'
  import type { MethodDefinition, Verdict } from '../engine'

  interface Props {
    definition: MethodDefinition
    flashes: Record<string, Verdict | undefined>
    inventoryOccupied?: number
    wastedTicks?: { mode: 'live' | 'final'; count: number }
    onTarget?: (targetId: string) => void
    disabled?: boolean
  }

  let {
    definition,
    flashes,
    inventoryOccupied = 0,
    wastedTicks,
    onTarget,
    disabled = false,
  }: Props = $props()

  const slotIndices = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => index)

  const hotspotTargets = $derived(definition.targets.filter((target) => target.inventory !== true))
  const inventoryTargets = $derived(definition.targets.filter((target) => target.inventory === true))

  function flashClass(targetId: string): string {
    const verdict = flashes[targetId]
    if (verdict === undefined) return 'flash-none'
    return verdict === 'hit' ? 'flash-hit' : 'flash-bad'
  }
</script>

<div class="scene" role="group" aria-label="Practice scene">
  {#if wastedTicks !== undefined}
    <div class="wasted-banner" class:final={wastedTicks.mode === 'final'} role="status">
      <span class="wasted-label">wasted ticks</span>
      <span class="wasted-count">{wastedTicks.count}</span>
    </div>
  {/if}

  <div class="hotspots">
    {#each hotspotTargets as target (target.id)}
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

  {#each inventoryTargets as target (target.id)}
    <div class="inventory" aria-label="Inventory: {target.label}">
      <div class="inventory-grid">
        {#each slotIndices as index (index)}
          {#if index < inventoryOccupied}
            <button
              class="slot filled"
              type="button"
              aria-label="Drop {target.label}"
              onclick={() => onTarget?.(target.id)}
              {disabled}
            >
              {target.label}
            </button>
          {:else}
            <div class="slot empty"></div>
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .scene {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .hotspots {
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

  .wasted-banner {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 22px;
    border-radius: 8px;
    background: #a32626;
    color: #ffe0dc;
    animation: wasted-pulse 600ms ease-in-out infinite alternate;
  }

  .wasted-banner.final {
    background: #5c1c1c;
    animation: none;
  }

  .wasted-label {
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .wasted-count {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  @keyframes wasted-pulse {
    from {
      opacity: 0.75;
    }
    to {
      opacity: 1;
    }
  }

  .inventory-grid {
    display: grid;
    grid-template-columns: repeat(4, 64px);
    gap: 4px;
  }

  .slot {
    width: 64px;
    height: 64px;
    border-radius: 6px;
    font-size: 0.66rem;
    line-height: 1.2;
    overflow: hidden;
  }

  .slot.filled {
    border: 2px solid #44505f;
    background: #232c36;
    color: #e8c07a;
    cursor: pointer;
    padding: 2px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      transform 80ms ease;
  }

  .slot.filled:focus-visible {
    outline: 2px solid #8ab4f8;
    outline-offset: 2px;
  }

  .slot.filled:hover:enabled {
    border-color: #ff6b6b;
    transform: translateY(-1px);
  }

  .slot.filled:active:enabled {
    transform: translateY(1px);
  }

  .slot.filled:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .slot.empty {
    border: 2px dashed #2c3540;
    background: transparent;
  }
</style>
