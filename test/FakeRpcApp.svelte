<script lang="ts">
  import type { AtomPromiseSet } from "../src/index.ts";
  import { RegistryProvider } from "../src/index.ts";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import type { makeFakeRpc, SetCountInput } from "./FakeRpc.ts";
  import FakeRpcProbe from "./FakeRpcProbe.svelte";

  type FakeRpc = ReturnType<typeof makeFakeRpc>;

  interface Props {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly queryAtom: FakeRpc["queryAtom"];
    readonly mutationAtom: FakeRpc["mutationAtom"];
    readonly onReady: (mutation: AtomPromiseSet<number, SetCountInput>) => void;
  }

  const { registry, queryAtom, mutationAtom, onReady }: Props = $props();
</script>

<RegistryProvider {registry}>
  <FakeRpcProbe
    {queryAtom}
    {mutationAtom}
    {onReady}
  />
</RegistryProvider>
