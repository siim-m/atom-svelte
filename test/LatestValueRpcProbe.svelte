<script lang="ts">
  import * as Cause from "effect/Cause";
  import * as Option from "effect/Option";
  import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
  import type * as Atom from "effect/unstable/reactivity/Atom";
  import { useAtomValue } from "../src/index.ts";

  interface Props {
    readonly first: Atom.Atom<AsyncResult.AsyncResult<number, unknown>>;
    readonly second?: Atom.Atom<AsyncResult.AsyncResult<number, unknown>> | undefined;
  }

  const { first, second }: Props = $props();
  let useSecond = $state(false);
  const value = useAtomValue(() => (useSecond && second !== undefined ? second : first));
  const result = $derived(value.current);
  const failureName = (cause: Cause.Cause<unknown>): string => {
    const failure = Cause.squash(cause);
    return failure instanceof Error ? failure.name : String(failure);
  };
</script>

<p data-testid="latest-value-state">
  {result._tag}:{String(
    result.waiting,
  )}{#if result._tag === "Success"}:{result.value}{:else if result._tag === "Failure"}:{failureName(
      result.cause,
    )}:{Option.isSome(result.previousSuccess) ? result.previousSuccess.value.value : "none"}{/if}
</p>
{#if second !== undefined}
  <button
    data-testid="switch-latest-value"
    onclick={() => (useSecond = !useSecond)}>switch</button
  >
{/if}
