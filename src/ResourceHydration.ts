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

// Hydration keys whose transfer was already applied, per Svelte hydration map. A page load creates a
// new map, so this resets with each document.
const appliedTransfers = new WeakMap<Map<unknown, unknown>, Set<string>>();

/**
 * Reads a server transfer directly from Svelte's hydration map.
 *
 * Svelte's `hydratable` reads this map only while its `hydrating` flag is set. In Svelte 5.56.8
 * through 5.57.2, component code that resumes after a top-level `await` runs with that flag cleared:
 * `capture()` in `svelte/src/internal/client/reactivity/async.js` restores the effect, reaction,
 * component context and batch, but not `hydrating`. A resource first read after an `await` would
 * then miss its transfer and run its query again on the client. Svelte keeps the map for the whole
 * page, so this reads it without the flag. Remove this when `hydratable` works after an `await`.
 *
 * Because the map outlives hydration, each transfer applies at most once per page load. Otherwise a
 * provider that mounts later with the same registry would write the first page load's server
 * values over newer data.
 */
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

  let applied = appliedTransfers.get(state.h);
  if (applied === undefined) {
    applied = new Set();
    appliedTransfers.set(state.h, applied);
  }
  if (applied.has(hydrationKey)) {
    return undefined;
  }
  applied.add(hydrationKey);

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
