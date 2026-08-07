<script lang="ts">
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import SequentialHydratableResourceProbe from "./SequentialHydratableResourceProbe.svelte";

  interface Props {
    readonly first: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly second: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly registry: AtomRegistry.AtomRegistry;
  }

  const { first, second, registry }: Props = $props();
</script>

<RegistryProvider {registry}>
  <SequentialHydratableResourceProbe
    {first}
    {second}
  />
</RegistryProvider>
