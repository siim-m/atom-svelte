import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtomBindingsApp from "./AtomBindingsApp.svelte";
import DynamicAtomApp from "./DynamicAtomApp.svelte";
import LifecycleApp from "./LifecycleApp.svelte";
import { click, text } from "./TestDom.ts";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("atom bindings", () => {
  it("uses an external registry for reads, selectors, writes, and function values", async () => {
    const registry = AtomRegistry.make();
    const counterAtom = Atom.make({ count: 1, label: "initial" });
    const functionState = Atom.make<{ readonly value: () => string }>({
      value: () => "initial function",
    });
    const functionAtom = Atom.writable(
      (get) => get(functionState).value,
      (context, value: () => string) => context.set(functionState, { value }),
    );
    const component = mount(AtomBindingsApp, {
      target: document.body,
      props: { registry, counterAtom, functionAtom },
    });
    flushSync();

    expect(text("value")).toBe("initial:1");
    expect(text("selected")).toBe("1");
    expect(text("binding")).toBe("1");

    registry.set(counterAtom, { count: 2, label: "external" });
    flushSync();
    expect(text("value")).toBe("external:2");
    expect(text("selected")).toBe("2");
    expect(text("binding")).toBe("2");

    click("set");
    expect(registry.get(counterAtom)).toEqual({ count: 5, label: "set" });
    expect(text("value")).toBe("set:5");

    click("update");
    expect(registry.get(counterAtom)).toEqual({ count: 6, label: "set" });
    expect(text("selected")).toBe("6");

    click("set-function");
    expect(registry.get(functionAtom)()).toBe("stored");
    expect(text("function-value")).toBe("stored");

    await unmount(component);
    registry.dispose();
  });

  it("moves dynamic reads and their shared subscription to the selected atom", async () => {
    const registry = AtomRegistry.make();
    const first = Atom.make(1);
    const second = Atom.make(10);
    const starts = new Map<object, number>();
    const stops = new Map<object, number>();
    const subscribe = registry.subscribe.bind(registry);

    vi.spyOn(registry, "subscribe").mockImplementation((atom, callback, options) => {
      if (atom === first || atom === second) {
        starts.set(atom, (starts.get(atom) ?? 0) + 1);
      }
      const stop = subscribe(atom, callback, options);
      return () => {
        if (atom === first || atom === second) {
          stops.set(atom, (stops.get(atom) ?? 0) + 1);
        }
        stop();
      };
    });

    const component = mount(DynamicAtomApp, {
      target: document.body,
      props: { registry, first, second },
    });
    flushSync();

    expect(text("dynamic-first-read")).toBe("1");
    expect(text("dynamic-second-read")).toBe("1");
    expect(starts.get(first)).toBe(1);

    click("switch");
    expect(text("dynamic-first-read")).toBe("10");
    expect(starts.get(second)).toBe(1);
    expect(stops.get(first)).toBe(1);

    registry.set(first, 2);
    flushSync();
    expect(text("dynamic-first-read")).toBe("10");

    registry.set(second, 11);
    flushSync();
    expect(text("dynamic-first-read")).toBe("11");
    expect(text("dynamic-second-read")).toBe("11");

    await unmount(component);
    expect(stops.get(second)).toBe(1);
    registry.dispose();
  });

  it("mounts write-only helpers and releases every lifecycle binding", async () => {
    const registry = AtomRegistry.make();
    let refreshRuns = 0;
    const mountedAtom = Atom.make(1);
    const writableAtom = Atom.make(0);
    const refreshableAtom = Atom.make(() => ++refreshRuns);
    const subscribedAtom = Atom.make(1);
    const values: Array<number> = [];
    const mountStarts = new Map<object, number>();
    const mountStops = new Map<object, number>();
    const originalMount = registry.mount.bind(registry);

    vi.spyOn(registry, "mount").mockImplementation((atom) => {
      mountStarts.set(atom, (mountStarts.get(atom) ?? 0) + 1);
      const stop = originalMount(atom);
      return () => {
        mountStops.set(atom, (mountStops.get(atom) ?? 0) + 1);
        stop();
      };
    });

    const component = mount(LifecycleApp, {
      target: document.body,
      props: {
        registry,
        mountedAtom,
        writableAtom,
        refreshableAtom,
        subscribedAtom,
        onValue: (value: number) => values.push(value),
      },
    });
    flushSync();

    expect(mountStarts.get(mountedAtom)).toBe(1);
    expect(mountStarts.get(writableAtom)).toBe(1);
    expect(mountStarts.get(refreshableAtom)).toBe(1);
    expect(values).toEqual([1]);

    click("write-set");
    click("write-update");
    expect(registry.get(writableAtom)).toBe(11);

    expect(registry.get(refreshableAtom)).toBe(1);
    click("refresh");
    expect(registry.get(refreshableAtom)).toBe(2);

    registry.set(subscribedAtom, 2);
    await tick();
    expect(values).toEqual([1, 2]);

    await unmount(component);
    expect(mountStops.get(mountedAtom)).toBe(1);
    expect(mountStops.get(writableAtom)).toBe(1);
    expect(mountStops.get(refreshableAtom)).toBe(1);

    registry.set(subscribedAtom, 3);
    expect(values).toEqual([1, 2]);
    registry.dispose();
  });
});
