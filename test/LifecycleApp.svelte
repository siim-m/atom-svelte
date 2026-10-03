<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { RegistryProvider } from "../src/index.ts";
  import LifecycleProbe from "./LifecycleProbe.svelte";

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly mountedAtom: Atom.Atom<number>;
    readonly writableAtom: Atom.Writable<number>;
    readonly refreshableAtom: Atom.Atom<number>;
    readonly subscribedAtom: Atom.Atom<number>;
    readonly onValue: (value: number) => void;
  }

  const { registry, mountedAtom, writableAtom, refreshableAtom, subscribedAtom, onValue }: Props =
    $props();
</script>

<RegistryProvider {registry}>
  <LifecycleProbe
    {mountedAtom}
    {writableAtom}
    {refreshableAtom}
    {subscribedAtom}
    {onValue}
  />
</RegistryProvider>
