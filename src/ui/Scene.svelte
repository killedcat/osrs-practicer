<script lang="ts">
  import { INVENTORY_CAPACITY } from '../engine'
  import type { MethodDefinition, TargetSpec, Verdict } from '../engine'

  interface Props {
    definition: MethodDefinition
    flashes: Record<string, Verdict | undefined>
    inventoryOccupied?: number
    wastedTicks?: { mode: 'live' | 'final'; count: number }
    onTarget?: (targetId: string) => void
    disabled?: boolean
    clickedTargets?: ReadonlySet<string>
  }

  let {
    definition,
    flashes,
    inventoryOccupied = 0,
    wastedTicks,
    onTarget,
    disabled = false,
    clickedTargets,
  }: Props = $props()

  const slotIndices = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => index)

  const hotspotTargets = $derived(
    definition.targets.filter((target) => target.placement.region === 'viewport'),
  )
  const inventoryTargets = $derived(
    definition.targets.filter((target) => target.placement.region === 'inventory'),
  )
  const staticSlots = $derived(
    new Set(
      definition.targets.flatMap((target) => {
        const placement = target.placement
        if (placement.region === 'inventory' && placement.slot !== undefined) return [placement.slot]
        return []
      }),
    ),
  )
  const freeSlotIndices = $derived(slotIndices.filter((index) => !staticSlots.has(index)))

  function isFilled(target: TargetSpec, index: number): boolean {
    const placement = target.placement
    if (placement.region !== 'inventory') return false
    if (placement.slot !== undefined) return index === placement.slot
    const fill = Math.min(inventoryOccupied, freeSlotIndices.length)
    return freeSlotIndices.slice(0, fill).includes(index)
  }

  function flashClass(targetId: string): string {
    const verdict = flashes[targetId]
    if (verdict === undefined) return 'flash-none'
    return verdict === 'hit' ? 'flash-hit' : 'flash-bad'
  }

  function isClicked(targetId: string): boolean {
    return clickedTargets?.has(targetId) ?? false
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
        class:clicked={isClicked(target.id)}
        onclick={() => onTarget?.(target.id)}
        {disabled}
      >
        {target.label}
      </button>
    {/each}
  </div>

  {#each inventoryTargets as target (target.id)}
    <div
      class="inventory"
      class:clicked={isClicked(target.id)}
      aria-label="Inventory: {target.label}"
    >
      <div class="inventory-grid">
        {#each slotIndices as index (index)}
          {#if isFilled(target, index)}
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
    border: 2px solid var(--stone-dark);
    border-radius: 8px;
    background: var(--bg-deep);
    color: var(--text-muted);
    font-size: 1rem;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      transform 80ms ease;
  }

  .hotspot:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .hotspot:hover:enabled {
    border-color: var(--stone-light);
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
    background: var(--success-dim);
    border-color: var(--success);
    color: var(--text);
  }

  .hotspot.flash-bad {
    background: var(--error-dim);
    border-color: var(--error);
    color: var(--text);
  }

  .hotspot.clicked {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .wasted-banner {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 22px;
    border-radius: 8px;
    background: var(--error);
    color: var(--text);
    animation: wasted-pulse 600ms ease-in-out infinite alternate;
  }

  .wasted-banner.final {
    background: var(--error-dim);
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

  .inventory {
    border-radius: 8px;
  }

  .inventory.clicked {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
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
    border: 2px solid var(--stone-dark);
    background: var(--stone);
    color: var(--text);
    cursor: pointer;
    padding: 2px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      transform 80ms ease;
  }

  .slot.filled:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .slot.filled:hover:enabled {
    border-color: var(--error);
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
    border: 2px dashed var(--stone-dark);
    background: transparent;
  }
</style>
