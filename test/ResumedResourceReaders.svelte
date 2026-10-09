<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import { useAtomResource } from "../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  }

  const { atom }: Props = $props();
  const resource = useAtomResource(() => atom);
  let showFirst = $state(true);
  let showSecond = $state(true);
</script>

<button
  data-testid="toggle-first-reader"
  onclick={() => (showFirst = !showFirst)}>first</button
>
<button
  data-testid="toggle-second-reader"
  onclick={() => (showSecond = !showSecond)}>second</button
>
{#if showFirst}
  <svelte:boundary>
    <p data-testid="first-reader">{await resource.current}</p>

    {#snippet pending()}
      <p data-testid="first-reader">pending</p>
    {/snippet}
  </svelte:boundary>
{:else}
  <p data-testid="first-reader">hidden</p>
{/if}
{#if showSecond}
  <svelte:boundary>
    <p data-testid="second-reader">{await resource.current}</p>

    {#snippet pending()}
      <p data-testid="second-reader">pending</p>
    {/snippet}
  </svelte:boundary>
{:else}
  <p data-testid="second-reader">hidden</p>
{/if}
