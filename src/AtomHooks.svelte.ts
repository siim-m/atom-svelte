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

type FunctionValue<W> = 0 extends 1 & W ? never : Extract<W, (...args: never) => unknown>;

/**
 * Writes a value-mode atom. A function argument is an updater of the current value, so an atom
 * whose write type includes a function accepts only updaters.
 */
export type AtomValueSetter<R, W> = (
  value: [FunctionValue<W>] extends [never] ? W | ((value: R) => W) : (value: R) => W,
) => void;

/**
 * Writes an asynchronous atom and resolves with its success value. It does not accept
 * `Atom.Reset`, which returns the atom to its initial state and so leaves no result to wait for.
 */
export type AtomPromiseSetter<A, W> = (
  value: Exclude<W, Atom.Reset>,
  options?: AtomSetOptions,
) => Promise<A>;

/** Writes an asynchronous atom and resolves with its exit. It does not accept `Atom.Reset`. */
export type AtomPromiseExitSetter<A, E, W> = (
  value: Exclude<W, Atom.Reset>,
  options?: AtomSetOptions,
) => Promise<Exit.Exit<A, E>>;

/** Modes supported by writable atom helpers. */
export type AtomWriteMode = "value" | "promise" | "promiseExit";

/** Selects the setter for an atom write mode. */
export type AtomSetter<R, W, Mode extends AtomWriteMode = "value"> = Mode extends "promise"
  ? AtomPromiseSetter<AsyncResult.AsyncResult.Success<R>, W>
  : Mode extends "promiseExit"
    ? AtomPromiseExitSetter<
        AsyncResult.AsyncResult.Success<R>,
        AsyncResult.AsyncResult.Failure<R>,
        W
      >
    : AtomValueSetter<R, W>;

/** A stable reactive value with a read-only `current` and the setter for the selected mode. */
export interface AtomBinding<R, W, Mode extends AtomWriteMode = "value"> extends AtomValue<R> {
  readonly set: AtomSetter<R, W, Mode>;
}

/**
 * A value-mode binding whose `current` can be assigned, including with `bind:`. Every value it
 * reads can be written back.
 */
export interface WritableAtomBinding<R extends W, W = R> {
  get current(): R;
  set current(value: W);
  readonly set: AtomValueSetter<R, W>;
}

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

const makeValueSetter =
  (
    registry: AtomRegistry.AtomRegistry,
    input: WritableAtomInput<unknown, unknown>,
  ): AtomValueSetter<unknown, unknown> =>
  (value) => {
    const atom = resolveWritableAtom(input);
    if (typeof value === "function") {
      // A function argument is an updater; the public setter type enforces this.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      registry.update(atom, value as (value: unknown) => unknown);
    } else {
      registry.set(atom, value);
    }
  };

const writeAndGetResult = <A, E, W>(
  registry: AtomRegistry.AtomRegistry,
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  value: W,
): Effect.Effect<A, E> => {
  const atom = resolveWritableAtom(input);
  registry.set(atom, value);
  return AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
};

const makePromiseSetter =
  <A, E, W>(
    registry: AtomRegistry.AtomRegistry,
    input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  ): AtomPromiseSetter<A, W> =>
  (value, options) =>
    Effect.runPromise(writeAndGetResult(registry, input, value), options);

const makePromiseExitSetter =
  <A, E, W>(
    registry: AtomRegistry.AtomRegistry,
    input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  ): AtomPromiseExitSetter<A, E, W> =>
  (value, options) =>
    Effect.runPromiseExit(writeAndGetResult(registry, input, value), options);

const makeSetter = (
  registry: AtomRegistry.AtomRegistry,
  input: WritableAtomInput<unknown, unknown>,
  mode: AtomWriteMode,
):
  | AtomValueSetter<unknown, unknown>
  | AtomPromiseSetter<unknown, unknown>
  | AtomPromiseExitSetter<unknown, unknown, unknown> =>
  mode === "promise"
    ? makePromiseSetter(registry, assumeAsyncInput(input))
    : mode === "promiseExit"
      ? makePromiseExitSetter(registry, assumeAsyncInput(input))
      : makeValueSetter(registry, input);

/** Reads and writes an asynchronous atom in promise mode. Its `current` is read-only. */
export function useAtom<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promise" },
): AtomBinding<AsyncResult.AsyncResult<A, E>, W, "promise">;
/** Reads and writes an asynchronous atom in promise-exit mode. Its `current` is read-only. */
export function useAtom<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promiseExit" },
): AtomBinding<AsyncResult.AsyncResult<A, E>, W, "promiseExit">;
/**
 * Reads and writes an atom through one stable reactive object. Its `current` is assignable because
 * every value it reads can be written back.
 */
export function useAtom<R extends W, W>(
  input: WritableAtomInput<R, W>,
  options?: { readonly mode?: "value" },
): WritableAtomBinding<R, W>;
/** Reads and writes an atom whose read values cannot be written back. Its `current` is read-only. */
export function useAtom<R, W>(
  input: WritableAtomInput<R, W>,
  options?: { readonly mode?: "value" },
): AtomBinding<R, W>;
export function useAtom(input: unknown, options?: { readonly mode?: AtomWriteMode }): unknown {
  const registry = getAtomRegistry();
  const writableInput = assumeWritableInput(input);
  const value = useAtomValue(writableInput);
  const mode = options?.mode ?? "value";

  return {
    get current() {
      return value.current;
    },
    set current(next: unknown) {
      if (mode !== "value") {
        throw new TypeError(
          `current is read-only in ${mode} mode. Call set(value) to write the atom.`,
        );
      }
      registry.set(resolveWritableAtom(writableInput), next);
    },
    set: makeSetter(registry, writableInput, mode),
  };
}

/** Mounts an atom for the lifetime of the current component. */
export const useAtomMount = <A>(input: AtomInput<A>): void => {
  const registry = getAtomRegistry();
  $effect(() => registry.mount(resolveAtom(input)));
};

/** Mounts an asynchronous atom and returns a promise-mode setter. */
export function useAtomSet<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promise" },
): AtomPromiseSetter<A, W>;
/** Mounts an asynchronous atom and returns a promise-exit-mode setter. */
export function useAtomSet<A, E, W>(
  input: WritableAtomInput<AsyncResult.AsyncResult<A, E>, W>,
  options: { readonly mode: "promiseExit" },
): AtomPromiseExitSetter<A, E, W>;
/** Mounts a writable atom and returns a stable setter without a value. */
export function useAtomSet<R, W>(
  input: WritableAtomInput<R, W>,
  options?: { readonly mode?: "value" },
): AtomValueSetter<R, W>;
export function useAtomSet(input: unknown, options?: { readonly mode?: AtomWriteMode }): unknown {
  const registry = getAtomRegistry();
  const writableInput = assumeWritableInput(input);
  useAtomMount(writableInput);
  return makeSetter(registry, writableInput, options?.mode ?? "value");
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
