<script lang="ts">
  import * as Cause from "effect/Cause";
  import * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import { useAtomResource } from "../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { atom }: Props = $props();
  const resource = useAtomResource(() => atom, { includeFailure: true });
  const result = $derived(await resource.current);
</script>

<p data-testid="result-mode">
  {AsyncResult.isSuccess(result)
    ? `Success:${result.value}`
    : `Failure:${String(Cause.squash(result.cause))}`}
</p>
