<script lang="ts">
  import { getMethod, validateDefinition } from '../methods'
  import Practice from './Practice.svelte'

  const definition = getMethod('1t-chinchompas')
  if (definition === undefined) {
    throw new Error("method '1t-chinchompas' is not registered in allDefinitions")
  }

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
</script>

<main>
  <h1>{definition.name}</h1>
  <Practice {definition} />
</main>
