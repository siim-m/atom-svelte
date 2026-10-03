<!-- @component Hydrates the current atom registry before it renders children. -->
<script lang="ts">
  import type * as Hydration from "effect/reactivity/Hydration";
  import { type Snippet, untrack } from "svelte";
  import { getAtomRegistry } from "./RegistryContext.ts";
  import { hydrateRegistry } from "./ResourceHydration.ts";

  interface Props {
    readonly children?: Snippet | undefined;
    readonly state?: Iterable<Hydration.DehydratedAtom> | undefined;
  }

  let { children, state }: Props = $props();
  const registry = getAtomRegistry();
  let hydratedState = untrack(() => state);

  untrack(() => {
    if (state !== undefined) {
      hydrateRegistry(registry, state);
    }
  });

  $effect.pre(() => {
    if (state === hydratedState) {
      return;
    }
    hydratedState = state;
    if (state !== undefined) {
      hydrateRegistry(registry, state);
    }
  });
</script>

{@render children?.()}
