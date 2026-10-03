<script lang="ts">
  import type * as AtomRef from "effect/reactivity/AtomRef";
  import { untrack } from "svelte";
  import { fromAtomRef, useAtomRef, useAtomRefProp, useAtomRefPropValue } from "../src/index.ts";

  interface Model {
    readonly count: number;
    readonly label: string;
  }

  interface Props {
    readonly first: AtomRef.AtomRef<Model>;
    readonly second: AtomRef.AtomRef<Model>;
  }

  const { first, second }: Props = $props();
  let useSecond = $state(false);
  const direct = fromAtomRef(untrack(() => first));
  const staticCount = useAtomRefPropValue(
    untrack(() => first),
    "count",
  );
  const selected = useAtomRef(() => (useSecond ? second : first));
  const countRef = useAtomRefProp(() => (useSecond ? second : first), "count");
  const count = useAtomRefPropValue(() => (useSecond ? second : first), "count");
</script>

<p data-testid="direct-ref">{direct.current.label}:{direct.current.count}</p>
<p data-testid="static-prop-value">{staticCount.current}</p>
<p data-testid="selected-ref">{selected.current.label}:{selected.current.count}</p>
<p data-testid="prop-ref">{countRef.current.value}</p>
<p data-testid="prop-value">{count.current}</p>
<button
  data-testid="switch-ref"
  onclick={() => (useSecond = !useSecond)}>switch</button
>
<button
  data-testid="set-prop"
  onclick={() => countRef.current.set(countRef.current.value + 1)}
>
  set property
</button>
