<script lang="ts">
  interface Props {
    icon?: string
    size?: number
  }

  let { icon, size = 48 }: Props = $props()

  const ICON_COLORS: Record<string, string> = {
    water: '#5b9bd5',
    rock: '#8f8779',
    trap: '#b08d57',
    leaf: '#5da345',
    jar: '#c9a227',
    bundle: '#a5713f',
  }

  const FALLBACK_COLOR = '#b7b3a8'

  const color = $derived(ICON_COLORS[icon ?? ''] ?? FALLBACK_COLOR)
</script>

<svg width={size} height={size} viewBox="0 0 24 24" style:color aria-hidden="true">
  {#if icon === 'water'}
    <g fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="2.5" opacity="0.95" />
      <circle cx="12" cy="12" r="6" opacity="0.6" />
      <circle cx="12" cy="12" r="9.5" opacity="0.3" />
    </g>
  {:else if icon === 'rock'}
    <polygon
      points="4,16 6.5,7.5 13,4 19,8 20,14.5 15,20 7,19.5"
      fill="currentColor"
      fill-opacity="0.45"
      stroke="currentColor"
      stroke-width="1.4"
    />
  {:else if icon === 'trap'}
    <g fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="5" y="5" width="14" height="14" />
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
      <line x1="12" y1="5" x2="12" y2="19" />
    </g>
  {:else if icon === 'leaf'}
    <path
      d="M12 3 C 18 7, 18 15, 12 21 C 6 15, 6 7, 12 3 Z"
      fill="currentColor"
      fill-opacity="0.4"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" stroke-width="1.2" />
  {:else if icon === 'jar'}
    <g stroke="currentColor" stroke-width="1.5" fill="none">
      <rect x="8" y="8" width="8" height="11" rx="2" fill="currentColor" fill-opacity="0.25" />
      <rect x="9.5" y="4.5" width="5" height="3.5" rx="0.5" />
    </g>
  {:else if icon === 'bundle'}
    <g fill="currentColor" stroke="currentColor" stroke-width="1">
      <rect x="6" y="14" width="12" height="4.5" rx="1.5" fill-opacity="0.8" />
      <rect x="7.5" y="9.5" width="9" height="4.5" rx="1.5" fill-opacity="0.55" />
      <rect x="9" y="5" width="6" height="4.5" rx="1.5" fill-opacity="0.35" />
    </g>
  {:else}
    <polygon
      points="12,3 21,12 12,21 3,12"
      fill="currentColor"
      fill-opacity="0.35"
      stroke="currentColor"
      stroke-width="1.4"
    />
  {/if}
</svg>
