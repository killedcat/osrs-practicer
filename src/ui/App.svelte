<script lang="ts">
  import type { MethodDefinition } from '../engine/types'
  import { validateDefinition } from '../methods'
  import Catalog from './Catalog.svelte'
  import Practice from './Practice.svelte'

  type View = 'catalog' | 'practice'

  let view = $state<View>('catalog')
  let selected = $state<MethodDefinition | undefined>(undefined)

  function openMethod(definition: MethodDefinition): void {
    const errors = validateDefinition(definition)
    if (errors.length > 0) {
      const message = `invalid method definition '${definition.id}': ${errors
        .map((error) => `${error.path}: ${error.message}`)
        .join('; ')}`
      if (import.meta.env.DEV) {
        throw new Error(message)
      }
      console.error(message)
    }
    selected = definition
    view = 'practice'
  }

  function returnToCatalog(): void {
    selected = undefined
    view = 'catalog'
  }
</script>

<main>
  {#if view === 'practice' && selected !== undefined}
    <Practice definition={selected} onBack={returnToCatalog} />
  {:else}
    <Catalog onOpen={openMethod} />
  {/if}
</main>
