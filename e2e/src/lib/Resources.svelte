<script lang="ts">
  import { useAtomRefresh, useAtomResource } from "@siim-m/atom-svelte";
  import * as Cause from "effect/Cause";
  import * as AsyncResult from "effect/reactivity/AsyncResult";
  import { atoms } from "./atoms.ts";
  import { recordEvaluation } from "./probe.ts";

  const resources = Object.values(atoms).map((atom) =>
    useAtomResource(atom, { includeFailure: true }),
  );
  const refreshA = useAtomRefresh(atoms.a);

  const readAll = () => {
    recordEvaluation();
    return Promise.all(resources.map((resource) => resource.current));
  };

  const results = $derived(await readAll());
</script>

<ul data-testid="resources">
  {#each results as result, index (index)}
    <li>{AsyncResult.isSuccess(result) ? result.value : Cause.pretty(result.cause)}</li>
  {/each}
</ul>
<button
  type="button"
  onclick={refreshA}>Refresh a</button
>
