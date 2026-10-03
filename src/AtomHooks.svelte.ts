import { BROWSER } from "esm-env";
import * as Effect from "effect/Effect";
import type * as Exit from "effect/Exit";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { fromAtom, type AtomInput, type AtomValue, resolveAtom } from "./AtomAdapter.ts";
import { getAtomRegistry } from "./RegistryContext.ts";

/** An atom input that resolves to a writable atom. */
export type WritableAtomInput<R, W> = Atom.Writable<R, W> | (() => Atom.Writable<R, W>);

/** Options for waiting on an asynchronous atom write result. */
export interface AtomSetOptions {
  /** Cancels the returned result wait. It does not cancel the atom execution. */
  readonly signal?: AbortSignal | undefined;
}

/** Write methods for a value-mode atom binding. */
export interface AtomValueSet<R, W> {
  set(value: W): void;
  update(f: (value: R) => W): void;
}

/** Write methods for a promise-mode atom binding. */
export interface AtomPromiseSet<A, W> {
  set(value: W, options?: AtomSetOptions): Promise<A>;
}

/** Write methods for a promise-exit-mode atom binding. */
export interface AtomPromiseExitSet<A, E, W> {
  set(value: W, options?: AtomSetOptions): Promise<Exit.Exit<A, E>>;
}

/** Modes supported by writable atom helpers. */
export type AtomWriteMode = "value" | "promise" | "promiseExit";

/** Selects the write API for an atom binding mode. */
export type AtomSet<R, W, Mode extends AtomWriteMode = "value"> = Mode extends "promise"
  ? AtomPromiseSet<AsyncResult.AsyncResult.Success<R>, W>
  : Mode extends "promiseExit"
    ? AtomPromiseExitSet<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>, W>
    : AtomValueSet<R, W>;

/** A stable reactive value with write methods for the selected mode. */
export type AtomBinding<R, W, Mode extends AtomWriteMode = "value"> = AtomValue<R> &
  AtomSet<R, W, Mode>;

const selectorCache = new WeakMap<object, WeakMap<object, Atom.Atom<unknown>>>();

const getSelectedAtom = <A, B>(input: AtomInput<A>, selector: (value: A) => B): Atom.Atom<B> => {
  const source = resolveAtom(input);
  let sourceSelectors = selectorCache.get(source);
  if (sourceSelectors === undefined) {
    sourceSelectors = new WeakMap();
    selectorCache.set(source, sourceSelectors);
  }

  // The source and selector keys determine the mapped atom value type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const cached = sourceSelectors.get(selector) as Atom.Atom<B> | undefined;
  if (cached !== undefined) {
    return cached;
  }

  const selected = Atom.map(source, selector);
  sourceSelectors.set(selector, selected);
  return selected;
};

class StaticAtomValue<A> implements AtomValue<A> {
  readonly value: AtomValue<A>;

  constructor(value: AtomValue<A>) {
    this.value = value;
  }

  get current(): A {
    return this.value.current;
  }
}

class DynamicAtomValue<A> implements AtomValue<A> {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly input: AtomInput<A>;

  constructor(registry: AtomRegistry.AtomRegistry, input: AtomInput<A>) {
    this.registry = registry;
    this.input = input;
  }

  get current(): A {
    return fromAtom(this.registry, resolveAtom(this.input)).current;
  }
}

class ServerSelectedAtomValue<A, B> implements AtomValue<B> {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly atom: Atom.Atom<A>;
  readonly selector: (value: A) => B;

  constructor(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>, selector: (value: A) => B) {
    this.registry = registry;
    this.atom = atom;
    this.selector = selector;
  }

  get current(): B {
    return this.selector(Atom.getServerValue(this.atom, this.registry));
  }
}

class DynamicSelectedAtomValue<A, B> implements AtomValue<B> {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly input: AtomInput<A>;
  readonly selector: (value: A) => B;

  constructor(registry: AtomRegistry.AtomRegistry, input: AtomInput<A>, selector: (value: A) => B) {
    this.registry = registry;
    this.input = input;
    this.selector = selector;
  }

  get current(): B {
    if (!BROWSER) {
      return this.selector(Atom.getServerValue(resolveAtom(this.input), this.registry));
    }
    return fromAtom(this.registry, getSelectedAtom(this.input, this.selector)).current;
  }
}

/** Reads an atom as a stable Svelte reactive object. */
export function useAtomValue<A>(input: AtomInput<A>): AtomValue<A>;
/** Reads a selected atom value as a stable Svelte reactive object. */
export function useAtomValue<A, B>(input: AtomInput<A>, selector: (value: A) => B): AtomValue<B>;
export function useAtomValue<A, B>(
  input: AtomInput<A>,
  selector?: (value: A) => B,
): AtomValue<A> | AtomValue<B> {
  const registry = getAtomRegistry();

  if (typeof input === "function") {
    return selector === undefined
      ? new DynamicAtomValue(registry, input)
      : new DynamicSelectedAtomValue(registry, input, selector);
  }
  if (selector === undefined) {
    return new StaticAtomValue(fromAtom(registry, input));
  }
  return BROWSER
    ? new StaticAtomValue(fromAtom(registry, getSelectedAtom(input, selector)))
    : new ServerSelectedAtomValue(registry, input, selector);
}

const resolveWritableAtom = <R, W>(input: WritableAtomInput<R, W>): Atom.Writable<R, W> =>
  typeof input === "function" ? input() : input;

const assumeWritableInput = (input: unknown): WritableAtomInput<unknown, unknown> => {
  // Public overloads require a writable atom input.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return input as WritableAtomInput<unknown, unknown>;
};

const assumeAsyncInput = (
  input: WritableAtomInput<unknown, unknown>,
): WritableAtomInput<AsyncResult.AsyncResult<never>, unknown> => {
  // Public overloads permit asynchronous modes only for AsyncResult atoms.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return input as unknown as WritableAtomInput<AsyncResult.AsyncResult<never>, unknown>;
};

const makeValueSet = <R, W>(
  registry: AtomRegistry.AtomRegistry,
  input: WritableAtomInput<R, W>,
): AtomValueSet<R, W> => ({
  set(value) {
    registry.set(resolveWritableAtom(input), value);
  },
  update(f) {
    registry.update(resolveWritableAtom(input), f);
  },
});

const writeAndGetResult = <A, E, W>(
  registry: AtomRegistry.AtomRegistry,
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  value: W,
): Effect.Effect<A, E> => {
  const atom = resolveWritableAtom(input);
  registry.set(atom, value);
  return AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
};

const makePromiseSet = <A, E, W>(
  registry: AtomRegistry.AtomRegistry,
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
): AtomPromiseSet<A, W> => ({
  set(value, options) {
    return Effect.runPromise(writeAndGetResult(registry, input, value), options);
  },
});

const makePromiseExitSet = <A, E, W>(
  registry: AtomRegistry.AtomRegistry,
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
): AtomPromiseExitSet<A, E, W> => ({
  set(value, options) {
    return Effect.runPromiseExit(writeAndGetResult(registry, input, value), options);
  },
});

const makeWriteApi = (
  registry: AtomRegistry.AtomRegistry,
  input: WritableAtomInput<unknown, unknown>,
  mode: AtomWriteMode | undefined,
):
  | AtomValueSet<unknown, unknown>
  | AtomPromiseSet<unknown, unknown>
  | AtomPromiseExitSet<unknown, unknown, unknown> =>
  mode === "promise"
    ? makePromiseSet(registry, assumeAsyncInput(input))
    : mode === "promiseExit"
      ? makePromiseExitSet(registry, assumeAsyncInput(input))
      : makeValueSet(registry, input);

/** Reads and writes an asynchronous atom in promise mode. */
export function useAtom<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promise" },
): AtomValue<AsyncResult.AsyncResult<A, E>> & AtomPromiseSet<A, W>;
/** Reads and writes an asynchronous atom in promise-exit mode. */
export function useAtom<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promiseExit" },
): AtomValue<AsyncResult.AsyncResult<A, E>> & AtomPromiseExitSet<A, E, W>;
/** Reads and writes a writable atom through one stable reactive object. */
export function useAtom<R, W>(
  input: WritableAtomInput<R, W>,
  options?: { readonly mode?: "value" },
): AtomValue<R> & AtomValueSet<R, W>;
export function useAtom(input: unknown, options?: { readonly mode?: AtomWriteMode }): unknown {
  const registry = getAtomRegistry();
  const writableInput = assumeWritableInput(input);
  const value = useAtomValue(writableInput);
  const write = makeWriteApi(registry, writableInput, options?.mode);

  return {
    get current() {
      return value.current;
    },
    ...write,
  };
}

/** Mounts an atom for the lifetime of the current component. */
export const useAtomMount = <A>(input: AtomInput<A>): void => {
  const registry = getAtomRegistry();
  $effect(() => registry.mount(resolveAtom(input)));
};

/** Mounts an asynchronous atom and returns promise-mode write methods. */
export function useAtomSet<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promise" },
): AtomPromiseSet<A, W>;
/** Mounts an asynchronous atom and returns promise-exit-mode write methods. */
export function useAtomSet<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promiseExit" },
): AtomPromiseExitSet<A, E, W>;
/** Mounts a writable atom and returns stable write methods without a value. */
export function useAtomSet<R, W>(
  input: WritableAtomInput<R, W>,
  options?: { readonly mode?: "value" },
): AtomValueSet<R, W>;
export function useAtomSet(input: unknown, options?: { readonly mode?: AtomWriteMode }): unknown {
  const registry = getAtomRegistry();
  const writableInput = assumeWritableInput(input);
  useAtomMount(writableInput);
  return makeWriteApi(registry, writableInput, options?.mode);
}

/** Mounts an atom and returns a stable refresh function. */
export const useAtomRefresh = <A>(input: AtomInput<A>): (() => void) => {
  const registry = getAtomRegistry();
  useAtomMount(input);
  return () => registry.refresh(resolveAtom(input));
};

/** Subscribes a callback to a selected atom for the component lifetime. */
export const useAtomSubscribe = <A>(
  input: AtomInput<A>,
  f: (value: A) => void,
  options?: { readonly immediate?: boolean },
): void => {
  const registry = getAtomRegistry();
  $effect(() => registry.subscribe(resolveAtom(input), f, options));
};
