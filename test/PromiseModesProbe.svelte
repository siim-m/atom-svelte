<script lang="ts">
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import { untrack } from "svelte";
  import { useAtom, useAtomSet } from "../src/index.ts";
  import type { AsyncTestPromiseApi, AsyncTestWrite } from "./AsyncTestTypes.ts";

  interface Props {
    readonly atom: Atom.Writable<AsyncResult.AsyncResult<string, string>, AsyncTestWrite>;
    readonly onReady: (api: AsyncTestPromiseApi) => void;
  }

  const { atom, onReady }: Props = $props();
  const promise = useAtom(() => atom, { mode: "promise" });
  const promiseExit = useAtomSet(() => atom, { mode: "promiseExit" });
  untrack(() => onReady({ promise, promiseExit }));
</script>

<p data-testid="result-tag">{promise.current._tag}</p>
<p data-testid="result-waiting">{String(promise.current.waiting)}</p>
