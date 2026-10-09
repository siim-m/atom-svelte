import { BROWSER } from "esm-env";
import * as Cause from "effect/Cause";
import type * as Schema from "effect/Schema";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Hydration from "effect/reactivity/Hydration";
import { getAbortSignal, onDestroy } from "svelte";
import { createSubscriber } from "svelte/reactivity";
import { type AtomInput, type AtomValue, resolveAtom } from "./AtomAdapter.ts";
import { getRegistryContext, type RegistryContext } from "./RegistryContext.ts";

const valuePromiseCache = new WeakMap<object, Promise<unknown>>();
const resultPromiseCache = new WeakMap<object, Promise<unknown>>();

const getOptionalAbortSignal = (): AbortSignal | undefined => {
  try {
    return getAbortSignal();
  } catch (error) {
    if (error instanceof Error && error.message.includes("get_abort_signal_outside_reaction")) {
      return undefined;
    }
    throw error;
  }
};

type SettledResult<A, E> = AsyncResult.Success<A, E> | AsyncResult.Failure<A, E>;

type ResultConvert<A, E, Out> = (result: SettledResult<A, E>) => Promise<Out>;

const resultToValuePromise = <A, E>(result: SettledResult<A, E>): Promise<A> => {
  const cached = valuePromiseCache.get(result);
  if (cached !== undefined) {
    // The result determines the cached promise value type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return cached as Promise<A>;
  }

  const promise = AsyncResult.isSuccess(result)
    ? Promise.resolve(result.value)
    : Promise.reject<A>(Cause.squash(result.cause));
  valuePromiseCache.set(result, promise);
  return promise;
};

const resultToResultPromise = <A, E>(result: SettledResult<A, E>): Promise<SettledResult<A, E>> => {
  const cached = resultPromiseCache.get(result);
  if (cached !== undefined) {
    // The result determines the cached promise value type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return cached as Promise<SettledResult<A, E>>;
  }

  const promise = Promise.resolve(result);
  resultPromiseCache.set(result, promise);
  return promise;
};

const isSerializableAtom = <A>(
  atom: Atom.Atom<A>,
): atom is Atom.Atom<A> & Atom.Serializable<Schema.Constraint> => Atom.isSerializable(atom);

const isQuiescent = <A, E>(result: AsyncResult.AsyncResult<A, E>): result is SettledResult<A, E> =>
  !AsyncResult.isInitial(result) && !result.waiting;

const isUsable = <A, E>(
  result: AsyncResult.AsyncResult<A, E>,
  suspendOnWaiting: boolean,
): result is SettledResult<A, E> =>
  !AsyncResult.isInitial(result) && (!suspendOnWaiting || !result.waiting);

interface ResultWaiter<A, E> {
  readonly promise: Promise<SettledResult<A, E>>;
  readonly cancel: () => void;
}

const makeResultWaiter = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  accept: (result: AsyncResult.AsyncResult<A, E>) => result is SettledResult<A, E>,
  signal?: AbortSignal,
): ResultWaiter<A, E> => {
  let unsubscribe: (() => void) | undefined;
  let removeAbortListener = (): void => {};
  let rejectWaiter = (_error: unknown): void => {};
  let stopWhenSubscribed = false;
  let settled = false;

  const stop = (): void => {
    removeAbortListener();
    if (unsubscribe === undefined) {
      stopWhenSubscribed = true;
    } else {
      unsubscribe();
    }
  };

  const promise = new Promise<SettledResult<A, E>>((resolve, reject) => {
    rejectWaiter = reject;
    try {
      unsubscribe = registry.subscribe(
        atom,
        (result) => {
          if (settled || !accept(result)) {
            return;
          }
          settled = true;
          resolve(result);
          stop();
        },
        { immediate: true },
      );
      if (stopWhenSubscribed) {
        unsubscribe();
      }
    } catch (error) {
      settled = true;
      reject(error);
    }
  });

  if (signal !== undefined && !settled) {
    const onAbort = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      stop();
      rejectWaiter(signal.reason);
    };
    removeAbortListener = () => signal.removeEventListener("abort", onAbort);
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    promise,
    cancel: () => {
      if (settled) {
        return;
      }
      settled = true;
      stop();
    },
  };
};

const resolveServerResult = async <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal: AbortSignal | undefined,
): Promise<AsyncResult.AsyncResult<A, E>> => {
  const result = Atom.getServerValue(atom, registry);
  return Atom.ServerValueTypeId in atom || isQuiescent(result)
    ? result
    : makeResultWaiter(registry, atom, isQuiescent, signal).promise;
};

const serverResultCache = new WeakMap<
  RegistryContext,
  WeakMap<object, Promise<AsyncResult.AsyncResult<unknown, unknown>>>
>();

const getServerResult = <A, E>(
  context: RegistryContext,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal: AbortSignal | undefined,
): Promise<AsyncResult.AsyncResult<A, E>> => {
  let results = serverResultCache.get(context);
  if (results === undefined) {
    results = new WeakMap();
    serverResultCache.set(context, results);
  }

  const cached = results.get(atom);
  if (cached !== undefined) {
    // The atom object determines the cached result type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return cached as Promise<AsyncResult.AsyncResult<A, E>>;
  }

  const result = resolveServerResult(context.registry, atom, signal);
  results.set(atom, result);
  return result;
};

const getServerTransfer = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>> & Atom.Serializable<Schema.Constraint>,
  serializationKey: string,
  result: AsyncResult.AsyncResult<A, E>,
): Hydration.DehydratedAtomValue | undefined => {
  if (AsyncResult.isInitial(result)) {
    return undefined;
  }

  return {
    "~effect/reactivity/Hydration/DehydratedAtom": true as const,
    key: serializationKey,
    value: atom[Atom.SerializableTypeId].encode(result),
    dehydratedAt: Date.now(),
  };
};

interface WaitingCurrent<Out> {
  readonly promise: Promise<Out>;
  readonly cancel: () => void;
}

const foreverPending = new Promise<never>(() => {});

// A tracked read of a prepared resource runs only after the registry subscription is live, so the
// subscription reports every later change and nothing else.
class StaticAtomResource<A, E, Out> implements AtomValue<Promise<Out>> {
  readonly #subscribe: () => void;
  readonly context: RegistryContext;
  readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
  readonly suspendOnWaiting: boolean;
  readonly convert: ResultConvert<A, E, Out>;
  #prepared = false;
  #preparation: Promise<void> | undefined;
  readonly #pending = new Map<AbortSignal | undefined, Promise<Out>>();
  readonly #waiting = new Map<AbortSignal | undefined, WaitingCurrent<Out>>();
  #connectWhenPrepared: (() => void) | undefined;
  #stopSubscription: (() => void) | undefined;
  #serverResult: AsyncResult.AsyncResult<A, E> | undefined;
  #disposed = false;

  constructor(
    context: RegistryContext,
    atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
    suspendOnWaiting: boolean,
    convert: ResultConvert<A, E, Out>,
  ) {
    this.context = context;
    this.atom = atom;
    this.suspendOnWaiting = suspendOnWaiting;
    this.convert = convert;
    this.#subscribe = createSubscriber((update) => {
      let unsubscribe: (() => void) | undefined;
      const connect = (): void => {
        // Consume initialization notifications before Svelte tracks the subscription.
        this.context.registry.get(this.atom);
        unsubscribe = this.context.registry.subscribe(this.atom, update);
      };
      const stop = (): void => {
        if (this.#connectWhenPrepared === connect) {
          this.#connectWhenPrepared = undefined;
        }
        unsubscribe?.();
        unsubscribe = undefined;
        if (this.#stopSubscription === stop) {
          this.#stopSubscription = undefined;
        }
      };

      this.#stopSubscription = stop;
      if (this.#prepared) {
        // The read that follows in the same getter is covered, or sees the failed preparation.
        try {
          connect();
        } catch (error) {
          this.#failPreparation(error);
        }
      } else {
        this.#connectWhenPrepared = connect;
      }
      return stop;
    });
  }

  async #makePreparation(signal: AbortSignal | undefined): Promise<void> {
    const { resourceHydration } = this.context;
    const atom = this.atom;
    if (!isSerializableAtom(atom)) {
      if (!BROWSER) {
        this.#serverResult = await getServerResult(this.context, atom, signal);
      }
      return;
    }

    const serializationKey = atom[Atom.SerializableTypeId].key;
    let serverResultPromise: Promise<AsyncResult.AsyncResult<A, E>> | undefined;
    const loadServerResult = (): Promise<AsyncResult.AsyncResult<A, E>> =>
      (serverResultPromise ??= getServerResult(this.context, atom, signal));

    await resourceHydration.register(serializationKey, atom, async () => {
      if (BROWSER) {
        return undefined;
      }
      return getServerTransfer(atom, serializationKey, await loadServerResult());
    });
    if (!BROWSER) {
      this.#serverResult = await loadServerResult();
    }
  }

  #prepare(signal: AbortSignal | undefined): Promise<void> {
    if (this.#preparation !== undefined) {
      return this.#preparation;
    }

    try {
      this.#preparation = this.#makePreparation(signal).then(() => {
        // Reads chain on this promise, so they run after the subscription is live.
        const connect = this.#connectWhenPrepared;
        this.#connectWhenPrepared = undefined;
        connect?.();
        this.#prepared = true;
      });
    } catch (error) {
      this.#preparation = Promise.reject(error);
    }
    return this.#preparation;
  }

  #failPreparation(error: unknown): void {
    this.#prepared = false;
    this.#preparation = Promise.reject(error);
    this.#preparation.catch(() => {});
    this.#pending.clear();
    this.#stopWaiting();
  }

  #stopWaiting(): void {
    for (const waiting of this.#waiting.values()) {
      waiting.cancel();
    }
    this.#waiting.clear();
  }

  #waitForCurrent(signal: AbortSignal | undefined): Promise<Out> {
    if (this.#disposed) {
      return foreverPending;
    }
    const existing = this.#waiting.get(signal);
    if (existing !== undefined) {
      return existing.promise;
    }

    const waiter = makeResultWaiter(
      this.context.registry,
      this.atom,
      (result): result is SettledResult<A, E> => isUsable(result, this.suspendOnWaiting),
      signal,
    );
    const waiting: WaitingCurrent<Out> = {
      promise: waiter.promise.then(this.convert),
      cancel: waiter.cancel,
    };
    this.#waiting.set(signal, waiting);

    const clear = (): void => {
      if (this.#waiting.get(signal) === waiting) {
        this.#waiting.delete(signal);
      }
    };
    void waiting.promise.then(clear, clear);
    return waiting.promise;
  }

  #waitForPreparation(preparation: Promise<void>, signal: AbortSignal | undefined): Promise<Out> {
    if (this.#disposed) {
      return foreverPending;
    }
    const existing = this.#pending.get(signal);
    if (existing !== undefined) {
      return existing;
    }

    const pending = preparation.then(() => this.#readCurrent(signal));
    this.#pending.set(signal, pending);

    const clear = (): void => {
      if (this.#pending.get(signal) === pending) {
        this.#pending.delete(signal);
      }
    };
    void pending.then(clear, clear);
    return pending;
  }

  #readCurrent(signal: AbortSignal | undefined): Promise<Out> {
    try {
      const result = BROWSER
        ? this.context.registry.get(this.atom)
        : (this.#serverResult ?? Atom.getServerValue(this.atom, this.context.registry));
      if (isUsable(result, this.suspendOnWaiting)) {
        return this.convert(result);
      }
      if (!BROWSER && Atom.ServerValueTypeId in this.atom) {
        const state = AsyncResult.isInitial(result) ? "Initial" : "waiting";
        return Promise.reject(
          new Error(
            `Cannot await an Effect Atom resource on the server because its server value is ${state}. Render it inside a <svelte:boundary> with a pending snippet or provide a settled server value.`,
          ),
        );
      }
      return this.#waitForCurrent(signal);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#stopSubscription?.();
    this.#pending.clear();
    this.#stopWaiting();
  }

  get current(): Promise<Out> {
    const signal = getOptionalAbortSignal();
    this.#subscribe();
    const preparation = this.#prepare(signal);
    return this.#prepared
      ? this.#readCurrent(signal)
      : this.#waitForPreparation(preparation, signal);
  }
}

class DynamicAtomResource<A, E, Out> implements AtomValue<Promise<Out>> {
  readonly context: RegistryContext;
  readonly input: AtomInput<AsyncResult.AsyncResult<A, E>>;
  readonly suspendOnWaiting: boolean;
  readonly convert: ResultConvert<A, E, Out>;
  #atom: Atom.Atom<AsyncResult.AsyncResult<A, E>> | undefined;
  #resource: StaticAtomResource<A, E, Out> | undefined;

  constructor(
    context: RegistryContext,
    input: AtomInput<AsyncResult.AsyncResult<A, E>>,
    suspendOnWaiting: boolean,
    convert: ResultConvert<A, E, Out>,
  ) {
    this.context = context;
    this.input = input;
    this.suspendOnWaiting = suspendOnWaiting;
    this.convert = convert;
  }

  get current(): Promise<Out> {
    const atom = resolveAtom(this.input);
    if (this.#resource === undefined || this.#atom !== atom) {
      this.#resource?.dispose();
      this.#resource = new StaticAtomResource(
        this.context,
        atom,
        this.suspendOnWaiting,
        this.convert,
      );
      this.#atom = atom;
    }
    return this.#resource.current;
  }

  dispose(): void {
    this.#resource?.dispose();
    this.#resource = undefined;
    this.#atom = undefined;
  }
}

/** Options for an atom resource binding. */
export interface AtomResourceOptions {
  /** Waits for a quiescent result during a refresh instead of keeping the last success. */
  readonly suspendOnWaiting?: boolean | undefined;
  /** Resolves with the typed `Success` or `Failure` result instead of rejecting failures. */
  readonly includeFailure?: boolean | undefined;
}

/** Exposes an `AsyncResult` atom as a typed result promise for Svelte async expressions. */
export function useAtomResource<A, E>(
  input: AtomInput<AsyncResult.AsyncResult<A, E>>,
  options: AtomResourceOptions & { readonly includeFailure: true },
): AtomValue<Promise<AsyncResult.Success<A, E> | AsyncResult.Failure<A, E>>>;
/** Exposes an `AsyncResult` atom as a promise for Svelte async expressions. */
export function useAtomResource<A, E>(
  input: AtomInput<AsyncResult.AsyncResult<A, E>>,
  options?: AtomResourceOptions & { readonly includeFailure?: false | undefined },
): AtomValue<Promise<A>>;
export function useAtomResource<A, E>(
  input: AtomInput<AsyncResult.AsyncResult<A, E>>,
  options?: AtomResourceOptions,
): AtomValue<Promise<unknown>> {
  const context = getRegistryContext();
  const convert: ResultConvert<A, E, unknown> =
    options?.includeFailure === true ? resultToResultPromise : resultToValuePromise;
  const resource = new DynamicAtomResource(
    context,
    input,
    options?.suspendOnWaiting ?? false,
    convert,
  );
  const unregister = context.registerResourceCleanup(() => resource.dispose());
  onDestroy(() => {
    unregister();
    resource.dispose();
  });
  return resource;
}
