import type * as EffectType from "effect/Effect";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server atom resources without weak references", () => {
  // Some server runtimes have no `WeakRef` or `FinalizationRegistry`. Each module is imported after
  // the stubs, as it would load in such a runtime.
  it("renders a resource and rejects a different atom under its key", async () => {
    // Node loads its fetch globals on first access and they need `FinalizationRegistry`. Effect
    // reads `FormData` on import, so load them before the stubs.
    expect(globalThis.FormData).toBeDefined();
    vi.stubGlobal("WeakRef", undefined);
    vi.stubGlobal("FinalizationRegistry", undefined);
    const [
      { render },
      Effect,
      Schema,
      AsyncResult,
      Atom,
      AtomRegistry,
      { default: HydratableResourceApp },
    ] = await Promise.all([
      import("svelte/server"),
      import("effect/Effect"),
      import("effect/Schema"),
      import("effect/reactivity/AsyncResult"),
      import("effect/reactivity/Atom"),
      import("effect/reactivity/AtomRegistry"),
      import("./HydratableResourceApp.svelte"),
    ]);
    const makeAtom = (value: string) => {
      const query: EffectType.Effect<string, string> = Effect.succeed(value);
      return Atom.make(query).pipe(
        Atom.serializable({
          key: "without-weak-references",
          schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
        }),
      );
    };
    const registry = AtomRegistry.make();

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom: makeAtom("first") },
    });
    expect(rendered.body).toContain("first");
    await new Promise((done) => setTimeout(done, 0));
    // The registry dropped the node, so only the package's own record can detect the duplicate.
    expect(registry.getNodes().has("without-weak-references")).toBe(false);

    await expect(
      render(HydratableResourceApp, { props: { registry, atom: makeAtom("second") } }),
    ).rejects.toThrow("Duplicate Effect Atom serialization key");
    registry.dispose();
  });
});
