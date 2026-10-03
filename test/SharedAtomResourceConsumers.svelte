<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import { useAtomResource } from "../src/index.ts";
  import SharedAtomResourceValueProbe from "./SharedAtomResourceValueProbe.svelte";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { atom }: Props = $props();
  const resource = useAtomResource(() => atom, { suspendOnWaiting: true });
  let revision = $state(0);
</script>

<button
  data-testid="rerun-first-resource"
  onclick={() => (revision += 1)}
>
  rerun
</button>
<svelte:boundary>
  <SharedAtomResourceValueProbe
    {resource}
    {revision}
    testId="shared-resource-first"
  />

  {#snippet pending()}
    <p data-testid="shared-resource-first">pending</p>
  {/snippet}
</svelte:boundary>
<svelte:boundary>
  <SharedAtomResourceValueProbe
    {resource}
    testId="shared-resource-second"
  />

  {#snippet pending()}
    <p data-testid="shared-resource-second">pending</p>
  {/snippet}
</svelte:boundary>
