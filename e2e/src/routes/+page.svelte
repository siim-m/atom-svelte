<script lang="ts">
  import Resources from "$lib/Resources.svelte";
</script>

<h1>Home</h1>
<svelte:boundary>
  <Resources />

  {#snippet failed(error)}
    <p data-testid="failed">{error instanceof Error ? error.message : String(error)}</p>
  {/snippet}
</svelte:boundary>
