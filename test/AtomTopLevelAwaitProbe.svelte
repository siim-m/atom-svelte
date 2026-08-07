<script lang="ts">
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import { useAtomResource } from "../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { atom }: Props = $props();
  const resource = useAtomResource(() => atom, { suspendOnWaiting: true });
  const value = await resource.current;
</script>

<p data-testid="top-level-resource">success:{value}</p>
