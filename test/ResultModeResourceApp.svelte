<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import ResultModeResourceProbe from "./ResultModeResourceProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { registry, atom }: Props = $props();
</script>

<RegistryProvider {registry}>
  <svelte:boundary>
    <ResultModeResourceProbe {atom} />

    {#snippet pending()}
      <p data-testid="result-mode">pending</p>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
