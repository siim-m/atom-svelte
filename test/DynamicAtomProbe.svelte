<script lang="ts">
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import { useAtomValue } from "../src/index.ts";

  interface Props {
    readonly first: Atom.Atom<number>;
    readonly second: Atom.Atom<number>;
  }

  const { first, second }: Props = $props();
  let useSecond = $state(false);
  const value = useAtomValue(() => (useSecond ? second : first));
</script>

<p data-testid="dynamic-first-read">{value.current}</p>
<p data-testid="dynamic-second-read">{value.current}</p>
<button
  data-testid="switch"
  onclick={() => (useSecond = !useSecond)}>switch</button
>
