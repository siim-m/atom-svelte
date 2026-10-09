import * as AtomRegistry from "effect/reactivity/AtomRegistry";

/** The one registry of this document (browser only; the server makes one per request). */
export const browserRegistry = (): AtomRegistry.AtomRegistry =>
  (globalThis.__e2eRegistry ??= AtomRegistry.make());

let initialHydrationDone = false;

/** Called while the root layout hydrates. Later loads are client navigations. */
export const markInitialHydrationDone = (): void => {
  initialHydrationDone = true;
};

export const isInitialHydrationDone = (): boolean => initialHydrationDone;
