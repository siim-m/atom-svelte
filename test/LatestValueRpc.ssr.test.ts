import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { makeFakeRpc } from "./FakeRpc.ts";
import { makeLatestValueAtom } from "./LatestValueRpc.ts";
import LatestValueRpcApp from "./LatestValueRpcApp.svelte";

describe("latest-value RPC stream SSR", () => {
  it("renders Initial waiting state without starting the client-only stream", async () => {
    const fake = makeFakeRpc();
    const watch = fake.watch("ssr");
    const registry = AtomRegistry.make();
    const atom = makeLatestValueAtom(fake, watch);

    const rendered = await render(LatestValueRpcApp, {
      props: { registry, first: atom },
    });

    expect(rendered.body).toContain("Initial:true");
    expect(watch.startRuns).toBe(0);
    registry.dispose();
  });
});
