<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import LatestValueRpcProbe from "./LatestValueRpcProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly first: Atom.Atom<AsyncResult.AsyncResult<number, unknown>>;
    readonly second?: Atom.Atom<AsyncResult.AsyncResult<number, unknown>> | undefined;
  }

  const { registry, first, second }: Props = $props();
</script>

<RegistryProvider {registry}>
  <LatestValueRpcProbe
    {first}
    {second}
  />
</RegistryProvider>
