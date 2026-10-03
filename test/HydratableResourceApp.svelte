<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import HydratableResourceProbe from "./HydratableResourceProbe.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly registry?: AtomRegistry.AtomRegistry | undefined;
    readonly twoUses?: boolean | undefined;
    readonly hydrationScope?: string | undefined;
  }

  const { atom, registry, twoUses = false, hydrationScope }: Props = $props();
</script>

<RegistryProvider
  {registry}
  {hydrationScope}
>
  <svelte:boundary>
    <HydratableResourceProbe
      {atom}
      testId="resource-first"
    />
    {#if twoUses}
      <HydratableResourceProbe
        {atom}
        testId="resource-second"
      />
    {/if}

    {#snippet failed(error)}
      <p data-testid="resource-failure">{String(error)}</p>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
