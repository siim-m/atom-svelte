<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { untrack } from "svelte";
  import { RegistryProvider } from "../src/index.ts";
  import AtomResourceProbe from "./AtomResourceProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly first: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly second: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly onEvaluate?: (() => void) | undefined;
  }

  const { registry, first, second, onEvaluate }: Props = $props();
  let atom = $state(untrack(() => first));
</script>

<RegistryProvider {registry}>
  <button
    data-testid="switch-resource"
    onclick={() => (atom = atom === first ? second : first)}>switch</button
  >
  <svelte:boundary>
    <AtomResourceProbe
      {atom}
      suspendOnWaiting={true}
      onReady={() => {}}
      {onEvaluate}
    />

    {#snippet pending()}
      <p data-testid="resource-state">pending</p>
    {/snippet}
  </svelte:boundary>
</RegistryProvider>
