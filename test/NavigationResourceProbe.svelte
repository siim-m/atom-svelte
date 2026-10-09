<script lang="ts">
  import * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import { untrack } from "svelte";
  import { useAtomResource } from "../src/index.ts";

  interface Props {
    readonly atoms: ReadonlyArray<Atom.Atom<AsyncResult.AsyncResult<string, string>>>;
    readonly onEvaluate: () => void;
  }

  const { atoms, onEvaluate }: Props = $props();
  const resources = untrack(() =>
    atoms.map((atom) => useAtomResource(atom, { includeFailure: true })),
  );
  const readAll = () => {
    onEvaluate();
    return Promise.all(resources.map((resource) => resource.current));
  };
  const results = $derived(await readAll());
</script>

<p data-testid="navigation-resources">
  {results.map((result) => (AsyncResult.isSuccess(result) ? result.value : result._tag)).join(",")}
</p>
