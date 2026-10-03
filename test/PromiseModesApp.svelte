<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import type { AsyncTestPromiseApi, AsyncTestWrite } from "./AsyncTestTypes.ts";
  import PromiseModesProbe from "./PromiseModesProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Writable<AsyncResult.AsyncResult<string, string>, AsyncTestWrite>;
    readonly onReady: (api: AsyncTestPromiseApi) => void;
  }

  const { registry, atom, onReady }: Props = $props();
</script>

<RegistryProvider {registry}>
  <PromiseModesProbe
    {atom}
    {onReady}
  />
</RegistryProvider>
