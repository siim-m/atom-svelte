<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import HydratableResourceProbe from "./HydratableResourceProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly first: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly second: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { registry, first, second }: Props = $props();
</script>

<RegistryProvider {registry}>
  <HydratableResourceProbe
    atom={first}
    testId="first-provider"
  />
</RegistryProvider>
<RegistryProvider {registry}>
  <HydratableResourceProbe
    atom={second}
    testId="second-provider"
  />
</RegistryProvider>
