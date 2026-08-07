<script lang="ts">
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import { useAtom, useAtomValue } from "../src/index.ts";

  interface Counter {
    readonly count: number;
    readonly label: string;
  }

  interface Props {
    readonly counterAtom: Atom.Writable<Counter, Counter>;
    readonly functionAtom: Atom.Writable<() => string, () => string>;
  }

  const { counterAtom, functionAtom }: Props = $props();
  const value = useAtomValue(() => counterAtom);
  const selected = useAtomValue(
    () => counterAtom,
    (counter) => counter.count,
  );
  const counter = useAtom(() => counterAtom);
  const storedFunction = useAtom(() => functionAtom);
</script>

<p data-testid="value">{value.current.label}:{value.current.count}</p>
<p data-testid="selected">{selected.current}</p>
<p data-testid="binding">{counter.current.count}</p>
<p data-testid="function-value">{storedFunction.current()}</p>
<button
  data-testid="set"
  onclick={() => counter.set({ count: 5, label: "set" })}>set</button
>
<button
  data-testid="update"
  onclick={() => counter.update((current) => ({ ...current, count: current.count + 1 }))}
>
  update
</button>
<button
  data-testid="set-function"
  onclick={() => storedFunction.set(() => "stored")}>set function</button
>
