<script lang="ts">
  import { useAtomValue } from "../src/index.ts";
  import { getScopedAtom } from "./ScopedAtomContext.ts";

  const atom = getScopedAtom();
  const value = useAtomValue(atom);
  const selected = useAtomValue(atom, (current) => current * 2);
</script>

<p data-testid="scoped-value">{value.current}</p>
<p data-testid="scoped-selected">{selected.current}</p>
