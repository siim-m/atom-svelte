import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import SsrAtomApp from "./SsrAtomApp.svelte";

describe("server atom bindings", () => {
  it("renders server values and resolves a top-level resource await", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make("client").pipe(Atom.withServerValue(() => "server"));
    const subscribe = vi.spyOn(registry, "subscribe");

    const rendered = await render(SsrAtomApp, {
      props: { registry, atom },
    });

    expect(rendered.body).toContain("server");
    expect(rendered.body).toContain("selected:server");
    expect(rendered.body).toContain("static server");
    expect(rendered.body).toContain("selected:static server");
    expect(rendered.body).toContain("success:resource server");
    expect(rendered.body).not.toContain("client");
    expect(subscribe).not.toHaveBeenCalled();
    registry.dispose();
  });
});
