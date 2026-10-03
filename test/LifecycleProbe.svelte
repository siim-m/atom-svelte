<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import { useAtomMount, useAtomRefresh, useAtomSet, useAtomSubscribe } from "../src/index.ts";

  interface Props {
    readonly mountedAtom: Atom.Atom<number>;
    readonly writableAtom: Atom.Writable<number>;
    readonly refreshableAtom: Atom.Atom<number>;
    readonly subscribedAtom: Atom.Atom<number>;
    readonly onValue: (value: number) => void;
  }

  const { mountedAtom, writableAtom, refreshableAtom, subscribedAtom, onValue }: Props = $props();
  useAtomMount(() => mountedAtom);
  const writable = useAtomSet(() => writableAtom);
  const refresh = useAtomRefresh(() => refreshableAtom);
  useAtomSubscribe(
    () => subscribedAtom,
    (value) => onValue(value),
    { immediate: true },
  );
</script>

<button
  data-testid="write-set"
  onclick={() => writable.set(10)}>set</button
>
<button
  data-testid="write-update"
  onclick={() => writable.update((value) => value + 1)}>update</button
>
<button
  data-testid="refresh"
  onclick={refresh}>refresh</button
>
