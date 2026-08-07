<script lang="ts">
  import type { AtomPromiseSet } from "../src/index.ts";
  import { useAtom, useAtomValue } from "../src/index.ts";
  import { untrack } from "svelte";
  import type { makeFakeRpc, SetCountInput } from "./FakeRpc.ts";

  type FakeRpc = ReturnType<typeof makeFakeRpc>;

  interface Props {
    readonly queryAtom: FakeRpc["queryAtom"];
    readonly mutationAtom: FakeRpc["mutationAtom"];
    readonly onReady: (mutation: AtomPromiseSet<number, SetCountInput>) => void;
  }

  const { queryAtom, mutationAtom, onReady }: Props = $props();
  const query = useAtomValue(() => queryAtom);
  const mutation = useAtom(() => mutationAtom, { mode: "promise" });
  const queryResult = $derived(query.current);
  const mutationResult = $derived(mutation.current);
  untrack(() => onReady(mutation));
</script>

<p data-testid="query-state">
  {queryResult._tag}:{String(
    queryResult.waiting,
  )}{#if queryResult._tag === "Success"}:{queryResult.value}{/if}
</p>
<p data-testid="mutation-state">
  {mutationResult._tag}:{String(
    mutationResult.waiting,
  )}{#if mutationResult._tag === "Success"}:{mutationResult.value}{/if}
</p>
