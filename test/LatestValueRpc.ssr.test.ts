import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { makeFakeRpc } from "./FakeRpc.ts";
import LatestValueRpcApp from "./LatestValueRpcApp.svelte";

describe("latest-value RPC stream SSR", () => {
  it("renders Initial waiting state without starting the client-only stream", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const atom = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "ssr" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);

    const rendered = await render(LatestValueRpcApp, {
      props: { registry, first: atom },
    });

    expect(rendered.body).toContain("Initial:true");
    expect(fake.watch.startRuns("ssr")).toBe(0);
    registry.dispose();
  });
});
