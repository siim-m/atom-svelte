import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeRpc } from "../FakeRpc.ts";
import { makeLatestValueAtom } from "../LatestValueRpc.ts";
import { flushUntilText } from "../Poll.ts";
import { text } from "../TestDom.ts";
import LatestValueRpcAsyncDisabledApp from "./LatestValueRpcAsyncDisabledApp.svelte";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("latest-value RPC streams without experimental async", () => {
  it("compiles, mounts, and renders a stream emission", async () => {
    const fake = makeFakeRpc();
    const watch = fake.watch("async-disabled");
    const registry = AtomRegistry.make();
    const atom = makeLatestValueAtom(fake, watch);
    const component = mount(LatestValueRpcAsyncDisabledApp, {
      target: document.body,
      props: { registry, atom },
    });
    flushSync();
    await Effect.runPromise(Deferred.await(watch.started));

    await Effect.runPromise(watch.emit(1));
    await flushUntilText("latest-value-state", "Success:true:1");

    expect(text("latest-value-state")).toBe("Success:true:1");
    await unmount(component);
    registry.dispose();
  });
});
