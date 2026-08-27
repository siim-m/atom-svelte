import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import * as RpcTest from "effect/unstable/rpc/RpcTest";

class InvalidCount extends Schema.TaggedError<InvalidCount, { readonly brand: unique symbol }>()(
  "InvalidCount",
  {
    value: Schema.Number,
  },
) {}

const FakeRpcGroup = RpcGroup.make(
  Rpc.make("ReadCount", {
    success: Schema.Number,
  }),
  Rpc.make("SetCount", {
    payload: { value: Schema.Number },
    success: Schema.Number,
    error: InvalidCount,
  }),
  Rpc.make("WatchCount", {
    payload: { source: Schema.String },
    success: Schema.Number,
    error: Schema.String,
    stream: true,
  }),
);

export const countReactivityKeys = ["count"] as const;

export interface SetCountInput {
  readonly payload: { readonly value: number };
  readonly reactivityKeys?: ReadonlyArray<unknown> | undefined;
}

interface WatchControl {
  readonly queue: Queue.Queue<WatchMessage, string | Cause.Done>;
  readonly started: Deferred.Deferred<void>;
  finalizerRuns: number;
  startRuns: number;
}

interface WatchEmission {
  readonly _tag: "Emission";
  readonly value: number;
}

interface HeldWatchEmission {
  readonly _tag: "HeldEmission";
  readonly pulled: Deferred.Deferred<void>;
  readonly release: Deferred.Deferred<void>;
  readonly value: number;
}

type WatchMessage = WatchEmission | HeldWatchEmission;

export const makeFakeRpc = () => {
  const count = Ref.makeUnsafe(1);
  const queryRuns = Ref.makeUnsafe(0);
  const initialRead = Deferred.makeUnsafe<void>();
  const initialReadStarted = Deferred.makeUnsafe<void>();
  const refreshedRead = Deferred.makeUnsafe<void>();
  const refreshedReadStarted = Deferred.makeUnsafe<void>();
  const mutation = Deferred.makeUnsafe<void>();
  const mutationStarted = Deferred.makeUnsafe<void>();
  const watchControls = new Map<string, WatchControl>();
  const getOrCreateWatchControl = (source: string): WatchControl => {
    const existing = watchControls.get(source);
    if (existing !== undefined) {
      return existing;
    }
    const control: WatchControl = {
      queue: Effect.runSync(Queue.unbounded<WatchMessage, string | Cause.Done>()),
      started: Deferred.makeUnsafe<void>(),
      finalizerRuns: 0,
      startRuns: 0,
    };
    watchControls.set(source, control);
    return control;
  };

  const handlers = Effect.runSync(
    FakeRpcGroup.toHandlers({
      ReadCount: Effect.fnUntraced(function* () {
        const run = yield* Ref.updateAndGet(queryRuns, (current) => current + 1);
        if (run === 1) {
          yield* Deferred.succeed(initialReadStarted, undefined);
          yield* Deferred.await(initialRead);
        } else if (run === 2) {
          yield* Deferred.succeed(refreshedReadStarted, undefined);
          yield* Deferred.await(refreshedRead);
        }
        return yield* Ref.get(count);
      }),
      SetCount: Effect.fnUntraced(function* ({ value }) {
        if (value < 0) {
          return yield* new InvalidCount({ value });
        }
        yield* Deferred.succeed(mutationStarted, undefined);
        yield* Deferred.await(mutation);
        return yield* Ref.updateAndGet(count, () => value);
      }),
      WatchCount: ({ source }) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const control = getOrCreateWatchControl(source);
            control.startRuns += 1;
            yield* Deferred.succeed(control.started, undefined);
            return Stream.fromQueue(control.queue).pipe(
              Stream.mapEffect((message) => {
                if (message._tag === "Emission") {
                  return Effect.succeed(message.value);
                }
                return Effect.gen(function* () {
                  yield* Deferred.succeed(message.pulled, undefined);
                  yield* Deferred.await(message.release);
                  return message.value;
                });
              }),
              Stream.ensuring(
                Effect.sync(() => {
                  control.finalizerRuns += 1;
                }),
              ),
            );
          }),
        ),
    }),
  );

  const Client = AtomRpc.Service()("FakeRpcClient", {
    group: FakeRpcGroup,
    protocol: Layer.empty,
    makeEffect: RpcTest.makeClient(FakeRpcGroup, { flatten: true }).pipe(
      Effect.provideContext(handlers),
    ),
  });

  return {
    Client,
    count,
    initialRead,
    initialReadStarted,
    mutation,
    mutationAtom: Client.mutation("SetCount"),
    mutationStarted,
    queryAtom: Client.query("ReadCount", undefined, {
      reactivityKeys: countReactivityKeys,
    }),
    queryRuns,
    refreshedRead,
    refreshedReadStarted,
    watch: (source: string) => {
      const control = getOrCreateWatchControl(source);
      return {
        source,
        emit: (value: number) => Queue.offer(control.queue, { _tag: "Emission", value }),
        end: () => Queue.end(control.queue),
        fail: (error: string) => Queue.fail(control.queue, error),
        get finalizerRuns() {
          return control.finalizerRuns;
        },
        hold: (value: number) => {
          const pulled = Deferred.makeUnsafe<void>();
          const release = Deferred.makeUnsafe<void>();
          return {
            enqueue: Queue.offer(control.queue, {
              _tag: "HeldEmission",
              pulled,
              release,
              value,
            }),
            pulled,
            release: Deferred.succeed(release, undefined),
          };
        },
        started: control.started,
        get startRuns() {
          return control.startRuns;
        },
      };
    },
  };
};
