<script lang="ts">
  import type { AtomValue } from "../src/index.ts";

  interface Props {
    readonly resource: AtomValue<Promise<string>>;
    readonly revision?: number;
    readonly testId: string;
  }

  const { resource, revision = 0, testId }: Props = $props();
  const read = (_revision: number): Promise<string> => resource.current;
  const value = $derived(await read(revision));
</script>

<p data-testid={testId}>success:{value}</p>
