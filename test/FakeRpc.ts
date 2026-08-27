import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
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
);

export const countReactivityKeys = ["count"] as const;

export interface SetCountInput {
  readonly payload: { readonly value: number };
  readonly reactivityKeys?: ReadonlyArray<unknown> | undefined;
}

export const makeFakeRpc = () => {
  const count = Ref.makeUnsafe(1);
  const queryRuns = Ref.makeUnsafe(0);
  const initialRead = Deferred.makeUnsafe<void>();
  const initialReadStarted = Deferred.makeUnsafe<void>();
  const refreshedRead = Deferred.makeUnsafe<void>();
  const refreshedReadStarted = Deferred.makeUnsafe<void>();
  const mutation = Deferred.makeUnsafe<void>();
  const mutationStarted = Deferred.makeUnsafe<void>();

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
  };
};
