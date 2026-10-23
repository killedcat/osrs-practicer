<script lang="ts">
  import type { MethodDefinition, RunLog } from '../engine/types'
  import { validateDefinition } from '../methods'
  import Catalog from './Catalog.svelte'
  import Practice from './Practice.svelte'
  import Replay from './Replay.svelte'

  type View = 'catalog' | 'practice' | 'replay'

  let view = $state<View>('catalog')
  let selected = $state<MethodDefinition | undefined>(undefined)
  let finishedLog = $state<RunLog | undefined>(undefined)

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
    finishedLog = undefined
    view = 'practice'
  }

  function reviewRun(log: RunLog): void {
    finishedLog = log
    view = 'replay'
  }

  function returnToPractice(): void {
    view = 'practice'
  }

  function returnToCatalog(): void {
    selected = undefined
    finishedLog = undefined
    view = 'catalog'
  }
</script>

<main>
  {#if view === 'practice' && selected !== undefined}
    <Practice
      definition={selected}
      onBack={returnToCatalog}
      onReview={reviewRun}
      resumeRun={finishedLog}
    />
  {:else if view === 'replay' && selected !== undefined && finishedLog !== undefined}
    <Replay definition={selected} log={finishedLog} onBack={returnToPractice} />
  {:else}
    <Catalog onOpen={openMethod} />
  {/if}
</main>
