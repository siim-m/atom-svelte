<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../../src/index.ts";
  import LatestValueRpcProbe from "../LatestValueRpcProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<number, unknown>>;
  }

  const { registry, atom }: Props = $props();
</script>

<RegistryProvider {registry}>
  <LatestValueRpcProbe first={atom} />
</RegistryProvider>
