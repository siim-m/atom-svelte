<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import AssignableAtomProbe from "./AssignableAtomProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly queryAtom: Atom.Writable<string>;
    readonly functionAtom: Atom.Writable<() => string, () => string>;
  }

  const { registry, queryAtom, functionAtom }: Props = $props();
</script>

<RegistryProvider {registry}>
  <AssignableAtomProbe
    {queryAtom}
    {functionAtom}
  />
</RegistryProvider>
