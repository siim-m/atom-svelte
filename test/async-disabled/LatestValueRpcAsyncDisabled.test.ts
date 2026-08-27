import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeRpc } from "../FakeRpc.ts";
import { pollUntil } from "../Poll.ts";
import { text } from "../TestDom.ts";
import LatestValueRpcAsyncDisabledApp from "./LatestValueRpcAsyncDisabledApp.svelte";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("latest-value RPC streams without experimental async", () => {
  it("compiles, mounts, and renders a stream emission", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const atom = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) =>
            Effect.succeed(client("WatchCount", { source: "async-disabled" })),
          ),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const component = mount(LatestValueRpcAsyncDisabledApp, {
      target: document.body,
      props: { registry, atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(fake.watch.started("async-disabled")));

    await Effect.runPromise(fake.watch.emit("async-disabled", 1));
    await pollUntil(
      () => text("latest-value-state") === "Success:true:1",
      async () => {
        flushSync();
        await tick();
      },
    );

    expect(text("latest-value-state")).toBe("Success:true:1");
    await unmount(component);
    registry.dispose();
  });
});
