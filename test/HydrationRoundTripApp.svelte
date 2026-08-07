<script lang="ts">
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import HydratableResourceProbe from "./HydratableResourceProbe.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly registry: AtomRegistry.AtomRegistry;
  }

  const { atom, registry }: Props = $props();
</script>

<RegistryProvider {registry}>
  <HydratableResourceProbe
    {atom}
    testId="resource-first"
  />
</RegistryProvider>
