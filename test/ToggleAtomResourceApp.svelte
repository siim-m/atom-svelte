<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import ToggleAtomResourceProbe from "./ToggleAtomResourceProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { registry, atom }: Props = $props();
  let show = $state(true);
</script>

<RegistryProvider {registry}>
  <button
    data-testid="toggle-show"
    onclick={() => (show = !show)}>toggle</button
  >
  <ToggleAtomResourceProbe
    {atom}
    {show}
  />
</RegistryProvider>
