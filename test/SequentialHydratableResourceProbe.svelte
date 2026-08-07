<script lang="ts">
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import { useAtomResource } from "../src/index.ts";

  interface Props {
    readonly first: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly second: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { first, second }: Props = $props();
  const firstResource = useAtomResource(() => first, { suspendOnWaiting: true });
  const firstValue = await firstResource.current;
  const secondResource = useAtomResource(() => second, { suspendOnWaiting: true });
  const secondValue = await secondResource.current;
</script>

<p data-testid="sequential-first">{firstValue}</p>
<p data-testid="sequential-second">{secondValue}</p>
