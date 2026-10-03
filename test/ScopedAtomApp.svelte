<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { untrack } from "svelte";
  import { RegistryProvider } from "../src/index.ts";
  import { setScopedAtom } from "./ScopedAtomContext.ts";
  import ScopedAtomConsumer from "./ScopedAtomConsumer.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<number>;
  }

  const { registry, atom }: Props = $props();
  setScopedAtom(untrack(() => atom));
</script>

<RegistryProvider {registry}>
  <ScopedAtomConsumer />
</RegistryProvider>
