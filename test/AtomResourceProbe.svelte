<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import { untrack } from "svelte";
  import { useAtomResource } from "../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly suspendOnWaiting?: boolean;
    readonly onReady: (getPromise: () => Promise<string>) => void;
    readonly onEvaluate?: (() => void) | undefined;
  }

  const { atom, suspendOnWaiting = false, onReady, onEvaluate }: Props = $props();
  const resource = useAtomResource(() => atom, {
    suspendOnWaiting: untrack(() => suspendOnWaiting),
  });
  untrack(() => onReady(() => resource.current));
  const read = () => {
    onEvaluate?.();
    return resource.current;
  };
  const value = $derived(await read());
</script>

<p data-testid="resource-state">success:{value}</p>
