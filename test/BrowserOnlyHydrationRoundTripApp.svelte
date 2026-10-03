<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import HydratableResourceProbe from "./HydratableResourceProbe.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly registry: AtomRegistry.AtomRegistry;
  }

  const { atom, registry }: Props = $props();
</script>

<RegistryProvider {registry}>
  <svelte:boundary>
    <HydratableResourceProbe
      {atom}
      testId="browser-only-resource"
    />

    {#snippet pending()}
      <p data-testid="browser-only-resource">pending</p>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
