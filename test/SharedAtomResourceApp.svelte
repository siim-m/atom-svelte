<script lang="ts">
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import SharedAtomResourceConsumers from "./SharedAtomResourceConsumers.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { registry, atom }: Props = $props();
</script>

<RegistryProvider {registry}>
  <SharedAtomResourceConsumers {atom} />
</RegistryProvider>
