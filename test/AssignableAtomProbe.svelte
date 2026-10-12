<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import { useAtom } from "../src/index.ts";

  interface Props {
    readonly queryAtom: Atom.Writable<string>;
    readonly functionAtom: Atom.Writable<() => string, () => string>;
  }

  const { queryAtom, functionAtom }: Props = $props();
  const query = useAtom(() => queryAtom);
  const storedFunction = useAtom(() => functionAtom);
</script>

<input
  data-testid="query"
  bind:value={query.current}
/>
<p data-testid="query-value">{query.current}</p>
<button
  data-testid="clear"
  onclick={() => (query.current = "")}>clear</button
>
<p data-testid="function-value">{storedFunction.current()}</p>
<button
  data-testid="assign-function"
  onclick={() => (storedFunction.current = () => "assigned")}>assign function</button
>
