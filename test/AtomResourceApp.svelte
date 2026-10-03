<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import AtomResourceProbe from "./AtomResourceProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly suspendOnWaiting?: boolean;
    readonly onReady: (getPromise: () => Promise<string>) => void;
  }

  const { registry, atom, suspendOnWaiting = false, onReady }: Props = $props();
</script>

<RegistryProvider {registry}>
  <svelte:boundary>
    <AtomResourceProbe
      {atom}
      {suspendOnWaiting}
      {onReady}
    />

    {#snippet pending()}
      <p data-testid="resource-state">pending</p>
    {/snippet}
    {#snippet failed(error)}
      <p data-testid="resource-state">failure:{String(error)}</p>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
