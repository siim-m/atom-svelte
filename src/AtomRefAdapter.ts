import type * as AtomRef from "effect/reactivity/AtomRef";
import { createSubscriber } from "svelte/reactivity";
import type { AtomValue } from "./AtomAdapter.ts";

/** An atom ref or a reactive thunk that selects an atom ref. */
export type AtomRefInput<A> = AtomRef.ReadonlyRef<A> | (() => AtomRef.ReadonlyRef<A>);

const adapterCache = new WeakMap<object, AtomValue<unknown>>();

class StaticAtomRefValue<A> implements AtomValue<A> {
  readonly #subscribe: () => void;
  readonly ref: AtomRef.ReadonlyRef<A>;

  constructor(ref: AtomRef.ReadonlyRef<A>) {
    this.ref = ref;
    this.#subscribe = createSubscriber((update) => ref.subscribe(update));
  }

  get current(): A {
    this.#subscribe();
    return this.ref.value;
  }
}

/** Adapts one static atom ref to a cached Svelte reactive value. */
export const fromAtomRef = <A>(ref: AtomRef.ReadonlyRef<A>): AtomValue<A> => {
  // The ref key determines the cached adapter value type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const cached = adapterCache.get(ref) as AtomValue<A> | undefined;
  if (cached !== undefined) {
    return cached;
  }

  const adapter = new StaticAtomRefValue(ref);
  adapterCache.set(ref, adapter);
  return adapter;
};

/** Resolves a static atom ref or a reactive atom ref thunk. */
export const resolveAtomRef = <A>(input: AtomRefInput<A>): AtomRef.ReadonlyRef<A> =>
  typeof input === "function" ? input() : input;
