import { BROWSER } from "esm-env";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createSubscriber } from "svelte/reactivity";

/** A Svelte reactive value with a stable object identity. */
export interface AtomValue<A> {
  readonly current: A;
}

/** An atom or a reactive thunk that selects an atom. */
export type AtomInput<A> = Atom.Atom<A> | (() => Atom.Atom<A>);

const adapterCache = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<object, AtomValue<unknown>>>();

class StaticAtomValue<A> implements AtomValue<A> {
  readonly #subscribe: () => void;
  readonly registry: AtomRegistry.AtomRegistry;
  readonly atom: Atom.Atom<A>;

  constructor(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>) {
    this.registry = registry;
    this.atom = atom;
    this.#subscribe = createSubscriber((update) => registry.subscribe(atom, update));
  }

  get current(): A {
    const value = BROWSER
      ? this.registry.get(this.atom)
      : Atom.getServerValue(this.atom, this.registry);
    this.#subscribe();
    return value;
  }
}

/** Adapts one static atom in one registry to a cached Svelte reactive value. */
export const fromAtom = <A>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<A>,
): AtomValue<A> => {
  let atomCache = adapterCache.get(registry);
  if (atomCache === undefined) {
    atomCache = new WeakMap();
    adapterCache.set(registry, atomCache);
  }

  // The atom key fixes the cached adapter value type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const cached = atomCache.get(atom) as AtomValue<A> | undefined;
  if (cached !== undefined) {
    return cached;
  }

  const adapter = new StaticAtomValue(registry, atom);
  atomCache.set(atom, adapter);
  return adapter;
};

/** Resolves a static atom or a reactive atom thunk. */
export const resolveAtom = <A>(input: AtomInput<A>): Atom.Atom<A> =>
  typeof input === "function" ? input() : input;
