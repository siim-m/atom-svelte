<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import AtomResourceProbe from "./AtomResourceProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly hydrationScope: string;
  }

  const { registry, atom, hydrationScope }: Props = $props();
  let showProvider = $state(true);
</script>

<button
  data-testid="toggle-provider"
  onclick={() => (showProvider = !showProvider)}>provider</button
>
{#if showProvider}
  <RegistryProvider
    {registry}
    {hydrationScope}
  >
    <svelte:boundary>
      <AtomResourceProbe
        {atom}
        onReady={() => {}}
      />

      {#snippet pending()}
        <p data-testid="resource-state">pending</p>
      {/snippet}
    </svelte:boundary>
  </RegistryProvider>
{:else}
  <p data-testid="resource-state">hidden</p>
{/if}
