<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import DynamicAtomProbe from "./DynamicAtomProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly first: Atom.Atom<number>;
    readonly second: Atom.Atom<number>;
  }

  const { registry, first, second }: Props = $props();
</script>

<RegistryProvider {registry}>
  <DynamicAtomProbe
    {first}
    {second}
  />
</RegistryProvider>
