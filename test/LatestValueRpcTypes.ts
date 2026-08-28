import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Atom from "effect/unstable/reactivity/Atom";
import { makeFakeRpc } from "./FakeRpc.ts";

const fake = makeFakeRpc();

export const latestValueRecipe = fake.Client.runtime
  .atom(
    Stream.unwrap(
      fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "type-fixture" }))),
    ),
  )
  .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);

const unaryRpcEffect = fake.Client.use((client) => Effect.succeed(client("ReadCount", undefined)));

export const unaryRecipe = fake.Client.runtime
  .atom(
    Stream.unwrap(
      // @ts-expect-error A unary RPC yields an Effect, not a Stream.
      unaryRpcEffect,
    ),
  )
  .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
