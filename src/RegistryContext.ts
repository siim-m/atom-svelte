import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createContext } from "svelte";
import type { ResourceHydration } from "./ResourceHydration.ts";

export interface RegistryContext {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly resourceHydration: ResourceHydration;
  readonly registerResourceCleanup: (cleanup: () => void) => () => void;
}

const [getRegistryContextValue, setRegistryContextValue] = createContext<
  RegistryContext | undefined
>();

export const getRegistryContext = (): RegistryContext => {
  const context = getRegistryContextValue();
  if (context === undefined) {
    throw new Error("Atom hooks require a RegistryProvider");
  }
  return context;
};

/** Gets the atom registry for the current component subtree. */
export const getAtomRegistry = (): AtomRegistry.AtomRegistry => getRegistryContext().registry;

export const setRegistryContext = (context: RegistryContext): RegistryContext => {
  setRegistryContextValue(context);
  return context;
};
