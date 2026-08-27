import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { makeFakeRpc } from "./FakeRpc.ts";

interface WatchSource {
  readonly source: string;
}

export const makeLatestValueAtom = (fake: ReturnType<typeof makeFakeRpc>, watch: WatchSource) =>
  fake.Client.runtime
    .atom(
      Stream.unwrap(
        fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: watch.source }))),
      ),
    )
    .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
