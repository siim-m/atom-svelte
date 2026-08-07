import type * as AtomRef from "effect/unstable/reactivity/AtomRef";
import type { AtomValue } from "./AtomAdapter.ts";
import { fromAtomRef, type AtomRefInput, resolveAtomRef } from "./AtomRefAdapter.ts";

/** A writable atom ref or a reactive thunk that selects one. */
export type WritableAtomRefInput<A> = AtomRef.AtomRef<A> | (() => AtomRef.AtomRef<A>);

class StaticAtomRefValue<A> implements AtomValue<A> {
  readonly value: AtomValue<A>;

  constructor(value: AtomValue<A>) {
    this.value = value;
  }

  get current(): A {
    return this.value.current;
  }
}

class DynamicAtomRefValue<A> implements AtomValue<A> {
  readonly input: AtomRefInput<A>;

  constructor(input: AtomRefInput<A>) {
    this.input = input;
  }

  get current(): A {
    return fromAtomRef(resolveAtomRef(this.input)).current;
  }
}

/** Reads an atom ref through one stable Svelte reactive object. */
export const useAtomRef = <A>(input: AtomRefInput<A>): AtomValue<A> =>
  typeof input === "function"
    ? new DynamicAtomRefValue(input)
    : new StaticAtomRefValue(fromAtomRef(input));

const propRefCache = new WeakMap<object, Map<PropertyKey, unknown>>();

const getPropRef = <A, K extends keyof A>(
  ref: AtomRef.AtomRef<A>,
  prop: K,
): AtomRef.AtomRef<A[K]> => {
  let props = propRefCache.get(ref);
  if (props === undefined) {
    props = new Map();
    propRefCache.set(ref, props);
  }

  // The source ref and property keys determine the cached ref value type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const cached = props.get(prop) as AtomRef.AtomRef<A[K]> | undefined;
  if (cached !== undefined) {
    return cached;
  }

  const propRef = ref.prop(prop);
  props.set(prop, propRef);
  return propRef;
};

class StaticValue<A> implements AtomValue<A> {
  readonly current: A;

  constructor(current: A) {
    this.current = current;
  }
}

class DynamicAtomRefProp<A, K extends keyof A> implements AtomValue<AtomRef.AtomRef<A[K]>> {
  readonly input: WritableAtomRefInput<A>;
  readonly prop: K;

  constructor(input: WritableAtomRefInput<A>, prop: K) {
    this.input = input;
    this.prop = prop;
  }

  get current(): AtomRef.AtomRef<A[K]> {
    const ref = typeof this.input === "function" ? this.input() : this.input;
    return getPropRef(ref, this.prop);
  }
}

/** Gets a cached property ref through one stable reactive object. */
export const useAtomRefProp = <A, K extends keyof A>(
  input: WritableAtomRefInput<A>,
  prop: K,
): AtomValue<AtomRef.AtomRef<A[K]>> =>
  typeof input === "function"
    ? new DynamicAtomRefProp(input, prop)
    : new StaticValue(getPropRef(input, prop));

/** Reads one atom ref property through one stable reactive object. */
export const useAtomRefPropValue = <A, K extends keyof A>(
  input: WritableAtomRefInput<A>,
  prop: K,
): AtomValue<A[K]> => {
  const property = useAtomRefProp(input, prop);
  return typeof input === "function"
    ? useAtomRef(() => property.current)
    : useAtomRef(property.current);
};
