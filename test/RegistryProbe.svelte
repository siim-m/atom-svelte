<script lang="ts">
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
  import { untrack } from "svelte";
  import { getAtomRegistry, useAtomValue } from "../src/index.ts";

  interface Props {
    readonly first: Atom.Atom<number>;
    readonly second: Atom.Atom<number>;
    readonly onRegistry: (registry: AtomRegistry.AtomRegistry) => void;
  }

  const { first, second, onRegistry }: Props = $props();
  const registry = getAtomRegistry();
  const firstValue = useAtomValue(() => first);
  const secondValue = useAtomValue(() => second);
  untrack(() => onRegistry(registry));
</script>

<p data-testid="provider-first">{firstValue.current}</p>
<p data-testid="provider-second">{secondValue.current}</p>
