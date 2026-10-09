<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import { useAtomResource } from "../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly show: boolean;
  }

  const { atom, show }: Props = $props();
  const resource = useAtomResource(() => atom);
</script>

{#if show}
  <svelte:boundary>
    <p data-testid="toggle-resource">success:{await resource.current}</p>

    {#snippet pending()}
      <p data-testid="toggle-resource">pending</p>
    {/snippet}
    {#snippet failed(error)}
      <p data-testid="toggle-resource">failure:{String(error)}</p>
    {/snippet}
  </svelte:boundary>
{:else}
  <p data-testid="toggle-resource">hidden</p>
{/if}
