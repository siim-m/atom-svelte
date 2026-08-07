<script lang="ts">
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
  import type * as Hydration from "effect/unstable/reactivity/Hydration";
  import { untrack } from "svelte";
  import { HydrationBoundary, RegistryProvider } from "../src/index.ts";
  import RegistryProbe from "./RegistryProbe.svelte";

  interface Props {
    readonly registry?: AtomRegistry.AtomRegistry;
    readonly first: Atom.Atom<number>;
    readonly second: Atom.Atom<number>;
    readonly initialValues?: Iterable<readonly [Atom.Atom<unknown>, unknown]>;
    readonly dehydratedState?: Iterable<Hydration.DehydratedAtom>;
    readonly boundaryState?: Iterable<Hydration.DehydratedAtom>;
    readonly nextBoundaryState?: Iterable<Hydration.DehydratedAtom>;
    readonly onRegistry: (registry: AtomRegistry.AtomRegistry) => void;
  }

  const {
    registry,
    first,
    second,
    initialValues,
    dehydratedState,
    boundaryState,
    nextBoundaryState,
    onRegistry,
  }: Props = $props();
  let currentBoundaryState = $state(untrack(() => boundaryState));
</script>

{#snippet content()}
  <HydrationBoundary state={currentBoundaryState}>
    <RegistryProbe
      {first}
      {second}
      {onRegistry}
    />
  </HydrationBoundary>
{/snippet}

{#if registry === undefined}
  <RegistryProvider
    {initialValues}
    {dehydratedState}
  >
    {@render content()}
  </RegistryProvider>
{:else}
  <RegistryProvider
    {registry}
    {dehydratedState}
  >
    {@render content()}
  </RegistryProvider>
{/if}

{#if nextBoundaryState !== undefined}
  <button
    data-testid="hydrate-next"
    onclick={() => (currentBoundaryState = nextBoundaryState)}>hydrate next</button
  >
{/if}
