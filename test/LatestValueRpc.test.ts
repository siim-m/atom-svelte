import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeRpc } from "./FakeRpc.ts";
import LatestValueRpcApp from "./LatestValueRpcApp.svelte";
import { flushStep, pollUntil } from "./Poll.ts";
import { click, text } from "./TestDom.ts";

const flushUntil = async (expected: string): Promise<void> => {
  await pollUntil(
    () => text("latest-value-state") === expected,
    async () => {
      flushSync();
      await tick();
    },
  );
  expect(text("latest-value-state")).toBe(expected);
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("latest-value RPC streams", () => {
  it("renders each emission as scalar latest-only state without consumer writes", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const atom = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "primary" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();

    await Effect.runPromise(Deferred.await(fake.watch.started("primary")));
    await flushUntil("Initial:true");

    await Effect.runPromise(fake.watch.emit("primary", 1));
    await flushUntil("Success:true:1");

    await Effect.runPromise(fake.watch.emit("primary", 2));
    await flushUntil("Success:true:2");
    expect(text("latest-value-state")).not.toContain("[1,2]");

    await unmount(component);
    registry.dispose();
  });

  it("finalizes the RPC stream after the final consumer detaches", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const atom = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "cleanup" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(fake.watch.started("cleanup")));

    await unmount(component);
    await pollUntil(() => fake.watch.finalizerRuns("cleanup") === 1, flushStep);

    expect(fake.watch.finalizerRuns("cleanup")).toBe(1);
    registry.dispose();
  });

  it("exposes stream failure while retaining the latest value as previous success", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const atom = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "failure" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(fake.watch.started("failure")));

    await Effect.runPromise(fake.watch.emit("failure", 1));
    await flushUntil("Success:true:1");

    await Effect.runPromise(fake.watch.fail("failure", "stream failed"));
    await flushUntil("Failure:false:stream failed:1");
    expect(fake.watch.startRuns("failure")).toBe(1);

    await unmount(component);
    registry.dispose();
  });

  it("settles the latest success when a non-empty stream completes", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const atom = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "finite" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(fake.watch.started("finite")));

    await Effect.runPromise(fake.watch.emit("finite", 2));
    await flushUntil("Success:true:2");

    await Effect.runPromise(fake.watch.end("finite"));
    await flushUntil("Success:false:2");

    await unmount(component);
    registry.dispose();
  });

  it("exposes NoSuchElementError when an empty stream completes", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const atom = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "empty" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(fake.watch.started("empty")));

    await Effect.runPromise(fake.watch.end("empty"));
    await flushUntil("Failure:false:NoSuchElementError:none");

    await unmount(component);
    registry.dispose();
  });

  it("switches subscriptions without letting late old-stream emissions cross over", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    const first = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "first" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const second = fake.Client.runtime
      .atom(
        Stream.unwrap(
          fake.Client.use((client) => Effect.succeed(client("WatchCount", { source: "second" }))),
        ),
      )
      .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first, second },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(fake.watch.started("first")));
    expect(fake.watch.startRuns("second")).toBe(0);

    await Effect.runPromise(fake.watch.emit("first", 1));
    await flushUntil("Success:true:1");

    click("switch-latest-value");
    await Effect.runPromise(Deferred.await(fake.watch.started("second")));
    await pollUntil(() => fake.watch.finalizerRuns("first") === 1, flushStep);
    await flushUntil("Initial:true");

    await Effect.runPromise(fake.watch.emit("first", 2));
    await flushStep();
    expect(text("latest-value-state")).toBe("Initial:true");

    await Effect.runPromise(fake.watch.emit("second", 10));
    await flushUntil("Success:true:10");
    expect(fake.watch.startRuns("first")).toBe(1);
    expect(fake.watch.startRuns("second")).toBe(1);

    await unmount(component);
    registry.dispose();
  });
});
