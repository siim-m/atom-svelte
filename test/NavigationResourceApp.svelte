<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import NavigationResourceProbe from "./NavigationResourceProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atoms: ReadonlyArray<Atom.Atom<AsyncResult.AsyncResult<string, string>>>;
    readonly onEvaluate: () => void;
  }

  const { registry, atoms, onEvaluate }: Props = $props();
  let route = $state("other");
</script>

<RegistryProvider {registry}>
  <button
    data-testid="navigate"
    onclick={() => (route = route === "other" ? "resources" : "other")}>navigate</button
  >
  {#if route === "resources"}
    <svelte:boundary>
      <NavigationResourceProbe
        {atoms}
        {onEvaluate}
      />

      {#snippet failed(error)}
        <p data-testid="navigation-resources">failure:{String(error)}</p>
      {/snippet}
    </svelte:boundary>
  {:else}
    <p data-testid="navigation-resources">other</p>
  {/if}
</RegistryProvider>
