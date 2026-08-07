<script lang="ts">
  import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import * as Atom from "effect/unstable/reactivity/Atom";
  import { useAtomResource, useAtomValue } from "../src/index.ts";

  interface Props {
    readonly atom: Atom.Atom<string>;
  }

  const { atom }: Props = $props();
  const value = useAtomValue(() => atom);
  const selected = useAtomValue(
    () => atom,
    (current) => `selected:${current}`,
  );
  const staticAtom = Atom.make("static client").pipe(Atom.withServerValue(() => "static server"));
  const staticValue = useAtomValue(staticAtom);
  const staticSelected = useAtomValue(staticAtom, (current) => `selected:${current}`);
  const resource = useAtomResource(
    Atom.make<AsyncResult.AsyncResult<string>>(AsyncResult.success("resource server")),
  );
  const resourceValue = await resource.current;
</script>

<p data-testid="ssr-value">{value.current}</p>
<p data-testid="ssr-selected">{selected.current}</p>
<p data-testid="ssr-static-value">{staticValue.current}</p>
<p data-testid="ssr-static-selected">{staticSelected.current}</p>
<p data-testid="ssr-resource">success:{resourceValue}</p>
