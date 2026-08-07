<script lang="ts">
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import SsrAtomProbe from "./SsrAtomProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<string>;
  }

  const { registry, atom }: Props = $props();
</script>

<RegistryProvider {registry}>
  <SsrAtomProbe {atom} />
</RegistryProvider>
