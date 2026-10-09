import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

declare global {
  /** Browser-side counters that the tests read and reset. */
  interface E2eProbe {
    /** Evaluations of the awaiting `$derived` in `Resources.svelte`. */
    evaluations: number;
    /** Browser runs of each atom effect, by atom name. */
    atomRuns: Record<string, number>;
  }

  var __e2e: E2eProbe | undefined;
  var __e2eRegistry: AtomRegistry.AtomRegistry | undefined;
}

export {};
