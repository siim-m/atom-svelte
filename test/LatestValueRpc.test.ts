import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeRpc } from "./FakeRpc.ts";
import { makeLatestValueAtom } from "./LatestValueRpc.ts";
import LatestValueRpcApp from "./LatestValueRpcApp.svelte";
import { flushStep, flushUntilText, pollUntil } from "./Poll.ts";
import { click, text } from "./TestDom.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("latest-value RPC streams", () => {
  it("renders each emission as scalar latest-only state without consumer writes", async () => {
    const fake = makeFakeRpc();
    const watch = fake.watch("primary");
    const registry = AtomRegistry.make();
    const atom = makeLatestValueAtom(fake, watch);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();

    await Effect.runPromise(Deferred.await(watch.started));
    await flushUntilText("latest-value-state", "Initial:true");

    await Effect.runPromise(watch.emit(1));
    await flushUntilText("latest-value-state", "Success:true:1");

    await Effect.runPromise(watch.emit(2));
    await flushUntilText("latest-value-state", "Success:true:2");

    await unmount(component);
    registry.dispose();
  });

  it("finalizes the RPC stream after the final consumer detaches", async () => {
    const fake = makeFakeRpc();
    const watch = fake.watch("cleanup");
    const registry = AtomRegistry.make();
    const atom = makeLatestValueAtom(fake, watch);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(watch.started));

    await unmount(component);
    await pollUntil(() => watch.finalizerRuns === 1, flushStep);

    expect(watch.finalizerRuns).toBe(1);
    registry.dispose();
  });

  it("exposes stream failure while retaining the latest value as previous success", async () => {
    const fake = makeFakeRpc();
    const watch = fake.watch("failure");
    const registry = AtomRegistry.make();
    const atom = makeLatestValueAtom(fake, watch);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(watch.started));

    await Effect.runPromise(watch.emit(1));
    await flushUntilText("latest-value-state", "Success:true:1");

    await Effect.runPromise(watch.fail("stream failed"));
    await flushUntilText("latest-value-state", "Failure:false:stream failed:1");
    expect(watch.startRuns).toBe(1);

    await unmount(component);
    registry.dispose();
  });

  it("settles the latest success when a non-empty stream completes", async () => {
    const fake = makeFakeRpc();
    const watch = fake.watch("finite");
    const registry = AtomRegistry.make();
    const atom = makeLatestValueAtom(fake, watch);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(watch.started));

    await Effect.runPromise(watch.emit(2));
    await flushUntilText("latest-value-state", "Success:true:2");

    await Effect.runPromise(watch.end());
    await flushUntilText("latest-value-state", "Success:false:2");

    await unmount(component);
    registry.dispose();
  });

  it("exposes NoSuchElementError when an empty stream completes", async () => {
    const fake = makeFakeRpc();
    const watch = fake.watch("empty");
    const registry = AtomRegistry.make();
    const atom = makeLatestValueAtom(fake, watch);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first: atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(watch.started));

    await Effect.runPromise(watch.end());
    await flushUntilText("latest-value-state", "Failure:false:NoSuchElementError:none");

    await unmount(component);
    registry.dispose();
  });

  it("switches subscriptions without letting late old-stream emissions cross over", async () => {
    const fake = makeFakeRpc();
    const firstWatch = fake.watch("first");
    const secondWatch = fake.watch("second");
    const registry = AtomRegistry.make();
    const first = makeLatestValueAtom(fake, firstWatch);
    const second = makeLatestValueAtom(fake, secondWatch);
    const component = mount(LatestValueRpcApp, {
      target: document.body,
      props: { registry, first, second },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(firstWatch.started));
    expect(secondWatch.startRuns).toBe(0);

    await Effect.runPromise(firstWatch.emit(1));
    await flushUntilText("latest-value-state", "Success:true:1");

    const lateEmission = firstWatch.hold(2);
    await Effect.runPromise(lateEmission.enqueue);
    await Effect.runPromise(lateEmission.awaitPulled);

    click("switch-latest-value");
    await Effect.runPromise(lateEmission.release);
    await flushStep();
    expect(text("latest-value-state")).toBe("Initial:true");

    await Effect.runPromise(Deferred.await(secondWatch.started));
    await pollUntil(() => firstWatch.finalizerRuns === 1, flushStep);
    expect(firstWatch.finalizerRuns).toBe(1);

    await Effect.runPromise(secondWatch.emit(10));
    await flushUntilText("latest-value-state", "Success:true:10");
    expect(firstWatch.startRuns).toBe(1);
    expect(secondWatch.startRuns).toBe(1);

    await unmount(component);
    registry.dispose();
  });
});
