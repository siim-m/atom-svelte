import * as Schema from "effect/Schema";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRef from "effect/reactivity/AtomRef";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Hydration from "effect/reactivity/Hydration";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtomRefProbe from "./AtomRefProbe.svelte";
import RegistryProviderApp from "./RegistryProviderApp.svelte";
import ScopedAtomApp from "./ScopedAtomApp.svelte";
import { click, text } from "./TestDom.ts";

const dehydratedValue = (key: string, value: unknown): Hydration.DehydratedAtomValue => ({
  "~effect/reactivity/Hydration/DehydratedAtom": true,
  key,
  value,
  dehydratedAt: 0,
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("atom refs and registry providers", () => {
  it("updates and switches direct and property atom ref bindings", async () => {
    const first = AtomRef.make({ count: 1, label: "first" });
    const second = AtomRef.make({ count: 10, label: "second" });
    const component = mount(AtomRefProbe, {
      target: document.body,
      props: { first, second },
    });
    flushSync();

    expect(text("direct-ref")).toBe("first:1");
    expect(text("static-prop-value")).toBe("1");
    expect(text("selected-ref")).toBe("first:1");
    expect(text("prop-ref")).toBe("1");
    expect(text("prop-value")).toBe("1");

    first.set({ count: 2, label: "first updated" });
    flushSync();
    expect(text("direct-ref")).toBe("first updated:2");
    expect(text("static-prop-value")).toBe("2");
    expect(text("selected-ref")).toBe("first updated:2");
    expect(text("prop-value")).toBe("2");

    click("switch-ref");
    expect(text("selected-ref")).toBe("second:10");
    expect(text("prop-ref")).toBe("10");
    expect(text("prop-value")).toBe("10");

    first.set({ count: 3, label: "old source" });
    flushSync();
    expect(text("direct-ref")).toBe("old source:3");
    expect(text("static-prop-value")).toBe("3");
    expect(text("selected-ref")).toBe("second:10");
    expect(text("prop-value")).toBe("10");

    click("set-prop");
    expect(second.value).toEqual({ count: 11, label: "second" });
    expect(text("selected-ref")).toBe("second:11");
    expect(text("prop-value")).toBe("11");

    await unmount(component);
  });

  it("disposes an owned registry after applying initial values and boundary hydration", async () => {
    const first = Atom.make(0);
    const hydrationKey = "owned-provider-second";
    const second = Atom.make(0).pipe(
      Atom.serializable({ key: hydrationKey, schema: Schema.Number }),
    );
    let registry: AtomRegistry.AtomRegistry | undefined;
    const component = mount(RegistryProviderApp, {
      target: document.body,
      props: {
        first,
        second,
        initialValues: [[first, 7]],
        boundaryState: [dehydratedValue(hydrationKey, 9)],
        nextBoundaryState: [dehydratedValue(hydrationKey, 10)],
        onRegistry: (current: AtomRegistry.AtomRegistry) => {
          registry = current;
        },
      },
    });
    flushSync();
    if (registry === undefined) {
      throw new Error("Owned registry was not exposed");
    }
    const dispose = vi.spyOn(registry, "dispose");

    expect(text("provider-first")).toBe("7");
    expect(text("provider-second")).toBe("9");

    click("hydrate-next");
    expect(text("provider-second")).toBe("10");

    await unmount(component);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("hydrates but does not dispose an external registry", async () => {
    const registry = AtomRegistry.make();
    const dispose = vi.spyOn(registry, "dispose");
    const first = Atom.make(1);
    const hydrationKey = "external-provider-second";
    const second = Atom.make(2).pipe(
      Atom.serializable({ key: hydrationKey, schema: Schema.Number }),
    );
    let exposed: AtomRegistry.AtomRegistry | undefined;
    const component = mount(RegistryProviderApp, {
      target: document.body,
      props: {
        registry,
        first,
        second,
        dehydratedState: [dehydratedValue(hydrationKey, 12)],
        onRegistry: (current: AtomRegistry.AtomRegistry) => {
          exposed = current;
        },
      },
    });
    flushSync();

    expect(exposed).toBe(registry);
    expect(text("provider-first")).toBe("1");
    expect(text("provider-second")).toBe("12");

    await unmount(component);
    expect(dispose).not.toHaveBeenCalled();
    registry.dispose();
  });

  it("reads the atom selected by a scoped atom context", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make(3);
    const component = mount(ScopedAtomApp, {
      target: document.body,
      props: { registry, atom },
    });
    flushSync();

    expect(text("scoped-value")).toBe("3");
    expect(text("scoped-selected")).toBe("6");
    registry.set(atom, 4);
    flushSync();
    expect(text("scoped-value")).toBe("4");
    expect(text("scoped-selected")).toBe("8");

    await unmount(component);
    registry.dispose();
  });
});
