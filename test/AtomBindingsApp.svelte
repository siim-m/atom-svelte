<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import AtomBindingsProbe from "./AtomBindingsProbe.svelte";

  interface Counter {
    readonly count: number;
    readonly label: string;
  }

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly counterAtom: Atom.Writable<Counter, Counter>;
    readonly functionAtom: Atom.Writable<() => string, () => string>;
  }

  const { registry, counterAtom, functionAtom }: Props = $props();
</script>

<RegistryProvider {registry}>
  <AtomBindingsProbe
    {counterAtom}
    {functionAtom}
  />
</RegistryProvider>
