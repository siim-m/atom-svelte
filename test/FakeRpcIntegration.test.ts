import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { AtomPromiseSet } from "../src/index.ts";
import FakeRpcApp from "./FakeRpcApp.svelte";
import { countReactivityKeys, makeFakeRpc, type SetCountInput } from "./FakeRpc.ts";
import { flushUntilText } from "./Poll.ts";
import { text } from "./TestDom.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("fake RPC integration", () => {
  it("runs query and mutation atoms through the public Svelte bindings", async () => {
    const fake = makeFakeRpc();
    const registry = AtomRegistry.make();
    let mutation: AtomPromiseSet<number, SetCountInput> | undefined;
    const component = mount(FakeRpcApp, {
      target: document.body,
      props: {
        registry,
        queryAtom: fake.queryAtom,
        mutationAtom: fake.mutationAtom,
        onReady: (ready: AtomPromiseSet<number, SetCountInput>) => {
          mutation = ready;
        },
      },
    });
    flushSync();
    if (mutation === undefined) {
      throw new Error("Mutation binding was not initialized");
    }

    await Effect.runPromise(Deferred.await(fake.initialReadStarted));
    await flushUntilText("query-state", "Initial:true");

    await Effect.runPromise(Deferred.succeed(fake.initialRead, undefined));
    await flushUntilText("query-state", "Success:false:1");
    expect(await Effect.runPromise(Ref.get(fake.queryRuns))).toBe(1);

    const setCount = mutation.set({
      payload: { value: 2 },
      reactivityKeys: countReactivityKeys,
    });
    await Effect.runPromise(Deferred.await(fake.mutationStarted));
    await flushUntilText("mutation-state", "Initial:true");

    await Effect.runPromise(Deferred.succeed(fake.mutation, undefined));
    await expect(setCount).resolves.toBe(2);
    await flushUntilText("mutation-state", "Success:false:2");
    await Effect.runPromise(Deferred.await(fake.refreshedReadStarted));
    await flushUntilText("query-state", "Success:true:1");

    await Effect.runPromise(Deferred.succeed(fake.refreshedRead, undefined));
    await flushUntilText("query-state", "Success:false:2");
    expect(await Effect.runPromise(Ref.get(fake.queryRuns))).toBe(2);

    await expect(
      mutation.set({
        payload: { value: -1 },
        reactivityKeys: countReactivityKeys,
      }),
    ).rejects.toMatchObject({ _tag: "InvalidCount", value: -1 });
    await tick();
    expect(text("query-state")).toBe("Success:false:2");
    expect(await Effect.runPromise(Ref.get(fake.queryRuns))).toBe(2);

    await unmount(component);
    registry.dispose();
  });
});
