<script lang="ts">
  import { INVENTORY_CAPACITY } from '../engine'
  import type { MethodDefinition, TargetSpec } from '../engine'
  import TargetIcon from './TargetIcon.svelte'

  const CLIENT_WIDTH = 765
  const CLIENT_HEIGHT = 503

  interface Props {
    definition: MethodDefinition
    inventoryOccupied: number
    onTarget: (targetId: string) => void
    disabled?: boolean
    chatMessages?: Array<{ text: string; kind: 'info' | 'good' | 'bad' }>
    viewportFlashes?: Record<string, string | undefined>
    clickedTargets?: Record<string, boolean>
  }

  let {
    definition,
    inventoryOccupied,
    onTarget,
    disabled = false,
    chatMessages = [],
    viewportFlashes,
    clickedTargets,
  }: Props = $props()

  type ViewportTarget = TargetSpec & { placement: { region: 'viewport'; x: number; y: number } }
  type InventoryTarget = TargetSpec & { placement: { region: 'inventory'; slot?: number } }

  let fitWidth = $state(0)
  let viewportEl = $state<HTMLDivElement>()
  let chatEl = $state<HTMLDivElement>()

  const scale = $derived(fitWidth > 0 ? Math.min(fitWidth / CLIENT_WIDTH, 1) : 1)

  const viewportTargets = $derived(
    definition.targets.filter(
      (target): target is ViewportTarget => target.placement.region === 'viewport',
    ),
  )
  const inventoryTargets = $derived(
    definition.targets.filter(
      (target): target is InventoryTarget => target.placement.region === 'inventory',
    ),
  )
  const dynamicTargets = $derived(
    inventoryTargets.filter((target) => target.placement.slot === undefined),
  )

  const slotTargets = $derived.by(() => {
    const slots: Array<InventoryTarget | undefined> = Array.from(
      { length: INVENTORY_CAPACITY },
      () => undefined,
    )
    for (const target of inventoryTargets) {
      const slot = target.placement.slot
      if (slot !== undefined) slots[slot] = target
    }
    const freeSlots = slots.flatMap((slot, index) => (slot === undefined ? [index] : []))
    const filled = Math.min(inventoryOccupied, freeSlots.length)
    if (dynamicTargets.length > 0) {
      const base = Math.floor(filled / dynamicTargets.length)
      let remainder = filled - base * dynamicTargets.length
      let cursor = 0
      for (const target of dynamicTargets) {
        const count = base + (remainder > 0 ? 1 : 0)
        if (remainder > 0) remainder -= 1
        for (let n = 0; n < count && cursor < freeSlots.length; n += 1) {
          slots[freeSlots[cursor]] = target
          cursor += 1
        }
      }
    }
    return slots
  })

  let hover = $state<{ x: number; y: number; label: string } | undefined>(undefined)

  function trackHover(event: MouseEvent, label: string): void {
    const rect = viewportEl?.getBoundingClientRect()
    if (rect === undefined) return
    hover = {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
      label,
    }
  }

  function clearHover(): void {
    hover = undefined
  }

  function flashKind(targetId: string): 'none' | 'hit' | 'bad' {
    const verdict = viewportFlashes?.[targetId]
    if (verdict === undefined) return 'none'
    return verdict === 'hit' ? 'hit' : 'bad'
  }

  function isClicked(targetId: string): boolean {
    return clickedTargets?.[targetId] ?? false
  }

  $effect(() => {
    const el = chatEl
    if (el === undefined) return
    if (chatMessages.length === 0) {
      el.scrollTop = 0
      return
    }
    el.scrollTop = el.scrollHeight
  })
</script>

<div class="shell-fit" bind:clientWidth={fitWidth} style:height="{CLIENT_HEIGHT * scale}px">
  <div class="client" style:transform="scale({scale})" role="group" aria-label="OSRS client">
    <div class="left-column">
      <div class="viewport" bind:this={viewportEl}>
        {#each viewportTargets as target (target.id)}
          <button
            type="button"
            class="world-target"
            class:flash-hit={flashKind(target.id) === 'hit'}
            class:flash-bad={flashKind(target.id) === 'bad'}
            class:clicked={isClicked(target.id)}
            style:left="{target.placement.x}%"
            style:top="{target.placement.y}%"
            aria-label={target.label}
            {disabled}
            onclick={() => onTarget(target.id)}
            onmouseenter={(event) => trackHover(event, target.label)}
            onmousemove={(event) => trackHover(event, target.label)}
            onmouseleave={clearHover}
          >
            <TargetIcon icon={target.icon} size={48} />
            {#if flashKind(target.id) !== 'none'}
              <span
                class="verdict-tag"
                class:tag-hit={flashKind(target.id) === 'hit'}
                class:tag-bad={flashKind(target.id) === 'bad'}
              >
                {viewportFlashes?.[target.id]}
              </span>
            {/if}
          </button>
        {/each}
        {#if hover !== undefined}
          <div
            class="hover-label"
            style:left="{hover.x}px"
            style:top="{hover.y}px"
            aria-hidden="true"
          >
            {hover.label}
          </div>
        {/if}
      </div>

      <div class="chatbox">
        <div class="chat-scroll" bind:this={chatEl}>
          {#each chatMessages as message, index (index)}
            <p
              class="chat-line"
              class:chat-good={message.kind === 'good'}
              class:chat-bad={message.kind === 'bad'}
            >
              {message.text}
            </p>
          {/each}
        </div>
      </div>
    </div>

    <div class="right-column">
      <div class="minimap-placeholder" aria-hidden="true"></div>

      <div class="inventory-panel">
        <div class="slot-grid">
          {#each slotTargets as target, index (index)}
            {#if target !== undefined}
              <button
                type="button"
                class="slot occupied"
                class:clicked={isClicked(target.id)}
                aria-label="Drop {target.label}"
                {disabled}
                onclick={() => onTarget(target.id)}
              >
                <TargetIcon icon={target.icon} size={26} />
              </button>
            {:else}
              <div class="slot" aria-hidden="true"></div>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .shell-fit {
    position: relative;
    width: 100%;
    max-width: 765px;
    margin-inline: auto;
  }

  .client {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    gap: 2px;
    width: 765px;
    height: 503px;
    box-sizing: border-box;
    transform-origin: top left;
    background: var(--bg-deep);
    border: 2px solid;
    border-color: var(--stone-light) var(--stone-dark) var(--stone-dark) var(--stone-light);
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 32px rgba(0, 0, 0, 0.55);
  }

  .left-column {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 512px;
  }

  .right-column {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .viewport {
    position: relative;
    overflow: hidden;
    height: 334px;
    border: 1px solid var(--stone-dark);
    background:
      radial-gradient(120% 80% at 50% 18%, rgba(126, 156, 82, 0.28) 0%, transparent 62%),
      radial-gradient(90% 70% at 70% 85%, rgba(94, 74, 44, 0.4) 0%, transparent 70%),
      linear-gradient(168deg, #35461f 0%, #2b3a1a 42%, #243117 68%, #1c2711 100%);
  }

  .world-target {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transform: translate(-50%, -50%);
  }

  .world-target:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .world-target:disabled {
    cursor: default;
  }

  .world-target.flash-hit {
    box-shadow: 0 0 0 3px var(--success);
    animation: flash-pulse 250ms ease-out 2;
  }

  .world-target.flash-bad {
    box-shadow: 0 0 0 3px var(--error);
    animation: flash-pulse 250ms ease-out 2;
  }

  .world-target.clicked {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @keyframes flash-pulse {
    from {
      filter: brightness(1.8);
    }
    to {
      filter: none;
    }
  }

  .verdict-tag {
    position: absolute;
    top: -16px;
    left: 50%;
    font-size: 9px;
    line-height: 1;
    white-space: nowrap;
    transform: translateX(-50%);
    text-shadow: 1px 1px 0 var(--bg-deep);
  }

  .tag-hit {
    color: var(--success);
  }

  .tag-bad {
    color: var(--error);
  }

  .hover-label {
    position: absolute;
    color: var(--title);
    font-size: 11px;
    line-height: 1.2;
    pointer-events: none;
    white-space: nowrap;
    text-shadow: 1px 1px 0 var(--bg-deep);
    transform: translate(8px, -140%);
  }

  .chatbox {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--stone-dark);
    border-top-color: var(--stone-light);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.2) 100%), var(--stone);
  }

  .chat-scroll {
    height: 100%;
    overflow-y: auto;
    padding: 6px 10px;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--stone-dark) transparent;
  }

  .chat-line {
    margin: 0 0 3px;
    color: var(--text);
    font-size: 11px;
    line-height: 1.45;
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
    overflow-wrap: break-word;
  }

  .chat-good {
    color: var(--success);
  }

  .chat-bad {
    color: var(--error);
  }

  .minimap-placeholder {
    flex: 1;
    border: 1px solid var(--stone-dark);
    background:
      radial-gradient(100% 100% at 50% 40%, rgba(255, 255, 255, 0.05) 0%, transparent 70%),
      var(--stone);
  }

  .inventory-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 275px;
    border: 1px solid var(--stone-dark);
    border-top-color: var(--stone-light);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(0, 0, 0, 0.22) 100%), var(--stone);
  }

  .slot-grid {
    display: grid;
    grid-template-columns: repeat(4, 36px);
    gap: 4px;
    justify-content: center;
  }

  .slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 34px;
    padding: 0;
    box-sizing: border-box;
    border: 2px solid;
    border-color: var(--stone-dark) var(--stone-light) var(--stone-light) var(--stone-dark);
    border-radius: 2px;
    background: var(--bg-deep);
    box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.55);
  }

  .slot.occupied {
    cursor: pointer;
    color: var(--text);
  }

  .slot.occupied:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .slot.occupied:hover:enabled {
    filter: brightness(1.25);
  }

  .slot.occupied:disabled {
    cursor: default;
  }

  .slot.occupied.clicked {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
