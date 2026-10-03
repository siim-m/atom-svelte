import { BROWSER } from "esm-env";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Hydration from "effect/reactivity/Hydration";
import { hydratable } from "svelte";

/** Namespaces this package's `hydratable` keys. Changing it invalidates transferred SSR state. */
export const resourceHydrationKeyPrefix = "@siim-m/atom-svelte:resource:";

export interface ResourceHydration {
  readonly register: (
    serializationKey: string,
    atom: object,
    makeTransfer: () => Promise<Hydration.DehydratedAtomValue | undefined>,
  ) => Promise<void>;
}

interface SvelteHydrationState {
  readonly h: Map<unknown, unknown>;
}

const isSvelteHydrationState = (value: unknown): value is SvelteHydrationState =>
  typeof value === "object" && value !== null && "h" in value && value.h instanceof Map;

const isDehydratedAtomValue = (value: unknown): value is Hydration.DehydratedAtomValue =>
  typeof value === "object" &&
  value !== null &&
  Reflect.get(value, "~effect/reactivity/Hydration/DehydratedAtom") === true &&
  typeof Reflect.get(value, "key") === "string" &&
  typeof Reflect.get(value, "dehydratedAt") === "number";

const serializableAtoms = new WeakMap<AtomRegistry.AtomRegistry, Map<string, object>>();

const registerSerializableAtom = (
  registry: AtomRegistry.AtomRegistry,
  serializationKey: string,
  atom: object,
): void => {
  let registered = serializableAtoms.get(registry);
  if (registered === undefined) {
    registered = new Map();
    serializableAtoms.set(registry, registered);
  }

  const previous = registered.get(serializationKey);
  const existingNode = registry.getNodes().get(serializationKey);
  if (
    (previous !== undefined && previous !== atom) ||
    (existingNode !== undefined && existingNode.atom !== atom)
  ) {
    throw new Error(
      `Duplicate Effect Atom serialization key ${JSON.stringify(serializationKey)} for different atom objects`,
    );
  }

  registered.set(serializationKey, atom);
};

const getTransferredResource = (
  hydrationKey: string,
): Promise<Hydration.DehydratedAtomValue | undefined> | undefined => {
  if (!BROWSER) {
    return undefined;
  }

  const state: unknown = Reflect.get(window, "__svelte");
  if (!isSvelteHydrationState(state) || !state.h.has(hydrationKey)) {
    return undefined;
  }

  // Svelte 5.56 keeps this map after its hydration flag clears. A later
  // sequential await must still consume the transfer produced for its SSR node.
  return Promise.resolve(state.h.get(hydrationKey)).then((entry) => {
    if (entry === undefined || isDehydratedAtomValue(entry)) {
      return entry;
    }
    throw new Error(`Invalid Svelte hydratable state for ${JSON.stringify(hydrationKey)}`);
  });
};

export const makeResourceHydration = (
  hydrationScopeId: string,
  registry: AtomRegistry.AtomRegistry,
): ResourceHydration => {
  const preparations = new Map<string, Promise<void>>();

  return {
    register: (serializationKey, atom, makeTransfer) => {
      registerSerializableAtom(registry, serializationKey, atom);

      const existing = preparations.get(serializationKey);
      if (existing !== undefined) {
        return existing;
      }

      const hydrationKey = `${resourceHydrationKeyPrefix}${JSON.stringify([
        hydrationScopeId,
        serializationKey,
      ])}`;
      const transfer =
        getTransferredResource(hydrationKey) ??
        hydratable<Promise<Hydration.DehydratedAtomValue | undefined>>(hydrationKey, () =>
          BROWSER ? Promise.resolve(undefined) : makeTransfer(),
        );
      const preparation = transfer.then((entry) => {
        if (BROWSER && entry !== undefined) {
          hydrateRegistry(registry, [entry]);
        }
      });
      preparations.set(serializationKey, preparation);
      return preparation;
    },
  };
};

export const hydrateRegistry = (
  registry: AtomRegistry.AtomRegistry,
  state: Iterable<Hydration.DehydratedAtom>,
): void => {
  const entries = Array.from(state);
  Hydration.hydrate(registry, entries);
  for (const entry of Hydration.toValues(entries)) {
    const node = registry.getNodes().get(entry.key);
    if (node !== undefined) {
      registry.get(node.atom);
    }
  }
};
