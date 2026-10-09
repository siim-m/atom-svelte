import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { flushSync, mount, settled, tick, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { resourceHydrationKeyPrefix } from "../src/ResourceHydration.ts";
import AtomResourceApp from "./AtomResourceApp.svelte";
import AtomTopLevelAwaitApp from "./AtomTopLevelAwaitApp.svelte";
import type { AsyncTestPromiseApi, AsyncTestRequest } from "./AsyncTestTypes.ts";
import DynamicAtomResourceApp from "./DynamicAtomResourceApp.svelte";
import NavigationResourceApp from "./NavigationResourceApp.svelte";
import { flushStep, pollUntil, tickStep } from "./Poll.ts";
import PromiseModesApp from "./PromiseModesApp.svelte";
import RemountedProviderApp from "./RemountedProviderApp.svelte";
import ResultModeResourceApp from "./ResultModeResourceApp.svelte";
import ResumedResourceReadersApp from "./ResumedResourceReadersApp.svelte";
import SharedAtomResourceApp from "./SharedAtomResourceApp.svelte";
import { click, text } from "./TestDom.ts";
import ToggleAtomResourceApp from "./ToggleAtomResourceApp.svelte";

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(window, "__svelte");
});

const resultSchema = AsyncResult.Schema({ success: Schema.String, error: Schema.String });

const makeSettledAtom = (value: string): Atom.Writable<AsyncResult.AsyncResult<string, string>> =>
  Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.success(value));

const makeSettledSerializableAtom = (
  value: string,
): Atom.Atom<AsyncResult.AsyncResult<string, string>> => {
  const query: Effect.Effect<string, string> = Effect.succeed(value);
  return Atom.make(query).pipe(
    Atom.serializable({ key: `settled-${value}`, schema: resultSchema }),
    Atom.keepAlive,
  );
};

/** Adds a server transfer to Svelte's hydration map, as a server-rendered page does. */
const addResourceTransfer = (
  hydrationScope: string,
  serializationKey: string,
  transfer: Promise<unknown>,
): void => {
  const hydrationKey = `${resourceHydrationKeyPrefix}${JSON.stringify([
    hydrationScope,
    serializationKey,
  ])}`;
  const state: unknown = Reflect.get(window, "__svelte");
  const map: unknown = typeof state === "object" && state !== null ? Reflect.get(state, "h") : null;
  if (map instanceof Map) {
    map.set(hydrationKey, transfer);
  } else {
    Reflect.set(window, "__svelte", { h: new Map([[hydrationKey, transfer]]) });
  }
};

/** Makes the next preparation of a serializable resource wait for a server transfer. */
const holdResourceTransfer = (hydrationScope: string, serializationKey: string): (() => void) => {
  let release = (): void => {};
  addResourceTransfer(
    hydrationScope,
    serializationKey,
    new Promise<undefined>((resolve) => {
      release = () => resolve(undefined);
    }),
  );
  return release;
};

describe("asynchronous atom bindings", () => {
  it("reports write results and can cancel waiting without canceling atom execution", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.fn<AsyncTestRequest>()((request): Effect.Effect<string, string> => {
      switch (request.kind) {
        case "success":
          return Effect.promise(() => request.value);
        case "failure":
          return Effect.fail("failed");
        case "never":
          return Effect.never;
        default:
          return request;
      }
    });
    let api: AsyncTestPromiseApi | undefined;
    const component = mount(PromiseModesApp, {
      target: document.body,
      props: {
        registry,
        atom,
        onReady: (ready: AsyncTestPromiseApi) => {
          api = ready;
        },
      },
    });
    flushSync();
    if (api === undefined) {
      throw new Error("Promise API was not initialized");
    }

    let resolveSuccess: ((value: string) => void) | undefined;
    const successValue = new Promise<string>((resolve) => {
      resolveSuccess = resolve;
    });
    const success = api.promise.set({ kind: "success", value: successValue });
    flushSync();
    expect(text("result-tag")).toBe("Initial");
    expect(text("result-waiting")).toBe("true");

    resolveSuccess?.("done");
    await expect(success).resolves.toBe("done");
    await tick();
    expect(text("result-tag")).toBe("Success");

    await expect(api.promise.set({ kind: "failure" })).rejects.toBe("failed");
    const failureExit = await api.promiseExit.set({ kind: "failure" });
    expect(Exit.isFailure(failureExit)).toBe(true);

    const controller = new AbortController();
    const interrupted = api.promiseExit.set({ kind: "never" }, { signal: controller.signal });
    controller.abort();
    const interruptedExit = await interrupted;
    expect(Exit.isFailure(interruptedExit)).toBe(true);
    if (Exit.isFailure(interruptedExit)) {
      expect(Cause.hasInterruptsOnly(interruptedExit.cause)).toBe(true);
    }
    await tick();
    expect(text("result-waiting")).toBe("true");

    await unmount(component);
    registry.dispose();
  });

  it("settles a direct top-level await that starts from Initial", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial());
    const component = mount(AtomTopLevelAwaitApp, {
      target: document.body,
      props: { registry, atom },
    });
    flushSync();
    expect(text("top-level-resource")).toBe("pending");

    registry.set(atom, AsyncResult.success("ready"));
    await pollUntil(() => text("top-level-resource") === "success:ready", flushStep);
    expect(text("top-level-resource")).toBe("success:ready");

    await unmount(component);
    registry.dispose();
  });

  it("releases a pending resource wait when its component unmounts", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial());
    const component = mount(AtomTopLevelAwaitApp, {
      target: document.body,
      props: { registry, atom },
    });
    flushSync();

    let node = registry.getNodes().get(atom);
    await pollUntil(
      () => node !== undefined,
      async () => {
        await tickStep();
        node = registry.getNodes().get(atom);
      },
    );
    expect(node?.listeners.size).toBeGreaterThan(0);

    await unmount(component);
    await new Promise((done) => setTimeout(done, 0));
    expect(node?.listeners.size).toBe(0);
    registry.dispose();
  });

  it("releases the old pending wait when a dynamic resource switches atoms", async () => {
    const registry = AtomRegistry.make();
    const first = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.success("first"));
    const second = Atom.make<AsyncResult.AsyncResult<string, string>>(
      AsyncResult.success("second"),
    );
    const component = mount(DynamicAtomResourceApp, {
      target: document.body,
      props: { registry, first, second },
    });
    flushSync();
    await settled();
    registry.set(first, AsyncResult.success("first", { waiting: true }));
    flushSync();

    let firstNode = registry.getNodes().get(first);
    await pollUntil(
      () => firstNode !== undefined,
      async () => {
        await tickStep();
        firstNode = registry.getNodes().get(first);
      },
    );
    expect(firstNode?.listeners.size).toBeGreaterThan(0);

    document.querySelector<HTMLButtonElement>('[data-testid="switch-resource"]')?.click();
    flushSync();
    let secondNode = registry.getNodes().get(second);
    await pollUntil(
      () => secondNode !== undefined,
      async () => {
        await tickStep();
        secondNode = registry.getNodes().get(second);
      },
    );

    await pollUntil(
      () => firstNode?.listeners.size === 0 && text("resource-state") === "success:second",
      flushStep,
    );
    expect(text("resource-state")).toBe("success:second");
    expect(firstNode?.listeners.size).toBe(0);
    expect(secondNode?.listeners.size).toBeGreaterThan(0);

    registry.set(first, AsyncResult.success("late-first"));
    flushSync();
    await settled();
    expect(text("resource-state")).toBe("success:second");

    document.querySelector<HTMLButtonElement>('[data-testid="switch-resource"]')?.click();
    flushSync();
    const firstListeners = (): number => registry.getNodes().get(first)?.listeners.size ?? 0;
    await pollUntil(
      () =>
        text("resource-state") === "success:late-first" &&
        secondNode?.listeners.size === 0 &&
        firstListeners() > 0,
      flushStep,
    );
    expect(text("resource-state")).toBe("success:late-first");
    expect(secondNode?.listeners.size).toBe(0);
    expect(firstListeners()).toBeGreaterThan(0);

    await unmount(component);
    expect(firstListeners()).toBe(0);
    registry.dispose();
  });

  it("owns pending waits per concurrent Svelte reaction", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial());
    const component = mount(SharedAtomResourceApp, {
      target: document.body,
      props: { registry, atom },
    });
    flushSync();

    let node = registry.getNodes().get(atom);
    await pollUntil(
      () => node?.listeners.size === 3,
      async () => {
        await tickStep();
        node = registry.getNodes().get(atom);
      },
    );
    expect(text("shared-resource-first")).toBe("pending");
    expect(text("shared-resource-second")).toBe("pending");
    expect(node?.listeners.size).toBe(3);

    document.querySelector<HTMLButtonElement>('[data-testid="rerun-first-resource"]')?.click();
    flushSync();
    await pollUntil(() => node?.listeners.size === 3, tickStep);
    expect(node?.listeners.size).toBe(3);

    await unmount(component);
    expect(node?.listeners.size).toBe(0);
    registry.dispose();
  });

  it("observes an atom update between a resumed read and its subscription", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.success("initial"));
    const component = mount(ToggleAtomResourceApp, {
      target: document.body,
      props: { registry, atom },
    });
    await pollUntil(() => text("toggle-resource") === "success:initial", flushStep);
    expect(text("toggle-resource")).toBe("success:initial");

    const toggleShow = (): void =>
      document.querySelector<HTMLButtonElement>('[data-testid="toggle-show"]')?.click();
    toggleShow();
    flushSync();
    await pollUntil(() => false, tickStep, 5);
    expect(text("toggle-resource")).toBe("hidden");
    registry.set(atom, AsyncResult.success("mid"));

    toggleShow();
    flushSync();
    registry.set(atom, AsyncResult.success("new"));
    await pollUntil(() => text("toggle-resource") === "success:new", flushStep);
    expect(text("toggle-resource")).toBe("success:new");

    await unmount(component);
    registry.dispose();
  });

  it("does not subscribe after its component is destroyed", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial());
    let getResource: (() => Promise<string>) | undefined;
    const component = mount(AtomResourceApp, {
      target: document.body,
      props: {
        registry,
        atom,
        onReady: (getCurrentResource: () => Promise<string>) => {
          getResource = getCurrentResource;
        },
      },
    });
    flushSync();
    if (getResource === undefined) {
      throw new Error("Resource API was not initialized");
    }

    // Read outside a reaction, then destroy before the preparation microtasks run.
    void getResource().catch(() => {});
    const unmounted = unmount(component);
    await unmounted;
    await pollUntil(() => false, tickStep, 5);

    expect(registry.getNodes().get(atom)?.listeners.size ?? 0).toBe(0);
    registry.dispose();
  });

  it("resolves typed failures when includeFailure is enabled", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial());
    const component = mount(ResultModeResourceApp, {
      target: document.body,
      props: { registry, atom },
    });
    flushSync();
    expect(text("result-mode")).toBe("pending");

    registry.set(atom, AsyncResult.success("ok"));
    await pollUntil(() => text("result-mode") === "Success:ok", flushStep);
    expect(text("result-mode")).toBe("Success:ok");

    registry.set(atom, AsyncResult.fail("broken"));
    await pollUntil(() => text("result-mode") === "Failure:broken", flushStep);
    expect(text("result-mode")).toBe("Failure:broken");

    await unmount(component);
    registry.dispose();
  });

  it("supports reactive derived await for pending, success, refresh, and failure", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial());
    let getResource: (() => Promise<string>) | undefined;
    const component = mount(AtomResourceApp, {
      target: document.body,
      props: {
        registry,
        atom,
        suspendOnWaiting: true,
        onReady: (getCurrentResource: () => Promise<string>) => {
          getResource = getCurrentResource;
        },
      },
    });
    flushSync();
    if (getResource === undefined) {
      throw new Error("Resource API was not initialized");
    }

    const initial = getResource();
    expect(getResource()).toBe(initial);
    expect(text("resource-state")).toBe("pending");

    registry.set(atom, AsyncResult.success("old", { waiting: true }));
    flushSync();
    expect(getResource()).toBe(initial);
    expect(text("resource-state")).toBe("pending");

    const successResult = AsyncResult.success<string, string>("ready");
    registry.set(atom, successResult);
    flushSync();
    await expect(initial).resolves.toBe("ready");
    const success = getResource();
    expect(getResource()).toBe(success);
    await expect(success).resolves.toBe("ready");
    await tick();
    expect(text("resource-state")).toBe("success:ready");

    registry.set(atom, AsyncResult.success("ready", { waiting: true }));
    flushSync();
    const refreshing = getResource();
    expect(getResource()).toBe(refreshing);
    expect(text("resource-state")).toBe("success:ready");

    registry.set(atom, AsyncResult.success("refreshed"));
    flushSync();
    await expect(refreshing).resolves.toBe("refreshed");
    await expect(getResource()).resolves.toBe("refreshed");
    await tick();
    expect(text("resource-state")).toBe("success:refreshed");

    const failureResult = AsyncResult.fail<string, string>("broken");
    registry.set(atom, failureResult);
    flushSync();
    const failure = getResource();
    expect(getResource()).toBe(failure);
    await expect(failure).rejects.toBe("broken");
    await tick();
    expect(text("resource-state")).toBe("failure:broken");

    await unmount(component);
    registry.dispose();
  });

  it("keeps the last success visible while a refresh waits by default", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.success("old"));
    let getResource: (() => Promise<string>) | undefined;
    const component = mount(AtomResourceApp, {
      target: document.body,
      props: {
        registry,
        atom,
        onReady: (getCurrentResource: () => Promise<string>) => {
          getResource = getCurrentResource;
        },
      },
    });
    flushSync();
    if (getResource === undefined) {
      throw new Error("Resource API was not initialized");
    }

    await expect(getResource()).resolves.toBe("old");
    await tick();
    expect(text("resource-state")).toBe("success:old");

    registry.set(atom, AsyncResult.success("old", { waiting: true }));
    flushSync();
    await expect(getResource()).resolves.toBe("old");
    await tick();
    expect(text("resource-state")).toBe("success:old");

    registry.set(atom, AsyncResult.success("new"));
    flushSync();
    await expect(getResource()).resolves.toBe("new");
    await tick();
    expect(text("resource-state")).toBe("success:new");

    await unmount(component);
    registry.dispose();
  });
  it.each([
    { kind: "plain", makeAtom: makeSettledAtom },
    { kind: "serializable", makeAtom: makeSettledSerializableAtom },
  ])(
    "evaluates an awaiting derived once when it mounts against settled $kind atoms",
    async ({ makeAtom }) => {
      const registry = AtomRegistry.make();
      const atoms = ["a", "b", "c", "d"].map(makeAtom);
      const releaseAtoms = atoms.map((atom) => registry.mount(atom));
      expect(atoms.every((atom) => AsyncResult.isSuccess(registry.get(atom)))).toBe(true);
      let evaluations = 0;
      const component = mount(NavigationResourceApp, {
        target: document.body,
        props: {
          registry,
          atoms,
          onEvaluate: () => {
            evaluations += 1;
          },
        },
      });
      flushSync();

      for (let round = 0; round < 3; round += 1) {
        evaluations = 0;
        click("navigate");
        await pollUntil(() => text("navigation-resources") === "a,b,c,d", flushStep);
        await pollUntil(() => false, tickStep, 5);
        expect(text("navigation-resources")).toBe("a,b,c,d");
        expect(evaluations).toBe(1);

        click("navigate");
        await pollUntil(() => text("navigation-resources") === "other", flushStep);
      }

      await unmount(component);
      for (const release of releaseAtoms) {
        release();
      }
      registry.dispose();
    },
  );

  it("evaluates an awaiting derived once when a dynamic resource switches to a settled atom", async () => {
    const registry = AtomRegistry.make();
    const first = makeSettledAtom("first");
    const second = makeSettledAtom("second");
    let evaluations = 0;
    const component = mount(DynamicAtomResourceApp, {
      target: document.body,
      props: {
        registry,
        first,
        second,
        onEvaluate: () => {
          evaluations += 1;
        },
      },
    });
    await pollUntil(() => text("resource-state") === "success:first", flushStep);
    await pollUntil(() => false, tickStep, 5);

    evaluations = 0;
    click("switch-resource");
    await pollUntil(() => text("resource-state") === "success:second", flushStep);
    await pollUntil(() => false, tickStep, 5);
    expect(text("resource-state")).toBe("success:second");
    expect(evaluations).toBe(1);

    await unmount(component);
    registry.dispose();
  });

  it("updates every reader that resumed before its subscription connected", async () => {
    const registry = AtomRegistry.make();
    const atom = makeSettledAtom("initial");
    const component = mount(ResumedResourceReadersApp, {
      target: document.body,
      props: { registry, atom },
    });
    await pollUntil(
      () => text("first-reader") === "initial" && text("second-reader") === "initial",
      flushStep,
    );

    click("toggle-first-reader");
    click("toggle-second-reader");
    await pollUntil(() => false, tickStep, 5);
    expect([text("first-reader"), text("second-reader")]).toEqual(["hidden", "hidden"]);

    // Both readers read before the restarted registry subscription connects.
    click("toggle-first-reader");
    registry.set(atom, AsyncResult.success("changed"));
    click("toggle-second-reader");
    await pollUntil(
      () => text("first-reader") === "changed" && text("second-reader") === "changed",
      flushStep,
    );
    expect([text("first-reader"), text("second-reader")]).toEqual(["changed", "changed"]);

    await unmount(component);
    registry.dispose();
  });

  it("connects a subscription that restarts while preparation is pending", async () => {
    const releaseTransfer = holdResourceTransfer("pending-scope", "pending-resource");
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(
      AsyncResult.success("initial"),
    ).pipe(Atom.serializable({ key: "pending-resource", schema: resultSchema }));
    const component = mount(ToggleAtomResourceApp, {
      target: document.body,
      props: { registry, atom, hydrationScope: "pending-scope" },
    });
    flushSync();
    await pollUntil(() => false, tickStep, 5);
    expect(text("toggle-resource")).toBe("pending");

    click("toggle-show");
    await pollUntil(() => false, tickStep, 5);
    expect(text("toggle-resource")).toBe("hidden");
    click("toggle-show");
    await pollUntil(() => false, tickStep, 5);
    expect(text("toggle-resource")).toBe("pending");

    releaseTransfer();
    await pollUntil(() => text("toggle-resource") === "success:initial", flushStep);
    expect(text("toggle-resource")).toBe("success:initial");

    registry.set(atom, AsyncResult.success("changed"));
    await pollUntil(() => text("toggle-resource") === "success:changed", flushStep);
    expect(text("toggle-resource")).toBe("success:changed");

    await unmount(component);
    registry.dispose();
  });

  it("rejects a resumed read when its subscription cannot connect", async () => {
    const registry = AtomRegistry.make();
    const atom = makeSettledAtom("initial");
    const component = mount(ToggleAtomResourceApp, {
      target: document.body,
      props: { registry, atom },
    });
    await pollUntil(() => text("toggle-resource") === "success:initial", flushStep);

    click("toggle-show");
    await pollUntil(() => false, tickStep, 5);
    registry.dispose();
    click("toggle-show");
    await pollUntil(() => text("toggle-resource")?.startsWith("failure:") === true, flushStep);
    expect(text("toggle-resource")).toContain("registry is disposed");

    await unmount(component);
  });

  it("retries a failed connection on the next read", async () => {
    const registry = AtomRegistry.make();
    const source = Atom.make(0);
    const atom = Atom.make((get): AsyncResult.AsyncResult<string, string> => {
      const value = get(source);
      if (value === 0) {
        throw new Error("not ready");
      }
      return AsyncResult.success(`ready:${value}`);
    });
    const component = mount(ToggleAtomResourceApp, {
      target: document.body,
      props: { registry, atom },
    });
    await pollUntil(() => text("toggle-resource")?.startsWith("failure:") === true, flushStep);
    expect(text("toggle-resource")).toContain("not ready");

    registry.set(source, 1);
    click("reset-resource");
    await pollUntil(() => text("toggle-resource") === "success:ready:1", flushStep);
    expect(text("toggle-resource")).toBe("success:ready:1");

    // The retried connection delivers later changes.
    registry.set(source, 2);
    await pollUntil(() => text("toggle-resource") === "success:ready:2", flushStep);
    expect(text("toggle-resource")).toBe("success:ready:2");

    await unmount(component);
    registry.dispose();
  });

  it("rejects a pending read when its subscription cannot connect after preparation", async () => {
    const releaseTransfer = holdResourceTransfer("failing-scope", "failing-resource");
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(
      AsyncResult.success("initial"),
    ).pipe(Atom.serializable({ key: "failing-resource", schema: resultSchema }));
    const component = mount(ToggleAtomResourceApp, {
      target: document.body,
      props: { registry, atom, hydrationScope: "failing-scope" },
    });
    flushSync();
    await pollUntil(() => false, tickStep, 5);
    expect(text("toggle-resource")).toBe("pending");

    registry.dispose();
    releaseTransfer();
    await pollUntil(() => text("toggle-resource")?.startsWith("failure:") === true, flushStep);
    expect(text("toggle-resource")).toContain("registry is disposed");

    await unmount(component);
  });
  it("applies a server transfer once when a provider remounts with the same registry", async () => {
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial()).pipe(
      Atom.serializable({ key: "remounted-resource", schema: resultSchema }),
      Atom.keepAlive,
    );
    addResourceTransfer(
      "remount-scope",
      "remounted-resource",
      Promise.resolve({
        "~effect/reactivity/Hydration/DehydratedAtom": true,
        key: "remounted-resource",
        value: atom[Atom.SerializableTypeId].encode(AsyncResult.success("server")),
        dehydratedAt: Date.now(),
      }),
    );
    const registry = AtomRegistry.make();
    const component = mount(RemountedProviderApp, {
      target: document.body,
      props: { registry, atom, hydrationScope: "remount-scope" },
    });
    await pollUntil(() => text("resource-state") === "success:server", flushStep);
    expect(text("resource-state")).toBe("success:server");

    registry.set(atom, AsyncResult.success("newer"));
    await pollUntil(() => text("resource-state") === "success:newer", flushStep);

    click("toggle-provider");
    await pollUntil(() => text("resource-state") === "hidden", flushStep);
    click("toggle-provider");
    await pollUntil(() => text("resource-state") === "success:newer", flushStep);
    await pollUntil(() => false, tickStep, 5);
    expect(text("resource-state")).toBe("success:newer");

    await unmount(component);
    registry.dispose();
  });
});
