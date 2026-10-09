import { browser } from "$app/environment";

const probe = (): E2eProbe | undefined => {
  if (!browser) {
    return undefined;
  }
  return (globalThis.__e2e ??= { evaluations: 0, atomRuns: {} });
};

/** Records one evaluation of the awaiting `$derived` in the browser. */
export const recordEvaluation = (): void => {
  const counters = probe();
  if (counters !== undefined) {
    counters.evaluations += 1;
  }
};

/** Records one browser run of an atom effect. */
export const recordAtomRun = (name: string): void => {
  const counters = probe();
  if (counters !== undefined) {
    counters.atomRuns[name] = (counters.atomRuns[name] ?? 0) + 1;
  }
};
