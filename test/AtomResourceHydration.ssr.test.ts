import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import { resourceHydrationKeyPrefix } from "../src/ResourceHydration.ts";
import DuplicateHydrationKeyApp from "./DuplicateHydrationKeyApp.svelte";
import FailingSiblingApp from "./FailingSiblingApp.svelte";
import HydratableResourceApp from "./HydratableResourceApp.svelte";
import SequentialHydratableResourceApp from "./SequentialHydratableResourceApp.svelte";
import TwoProvidersDuplicateKeyApp from "./TwoProvidersDuplicateKeyApp.svelte";

const serializableStringAtom = (
  key: string,
  effect: Effect.Effect<string, string>,
): Atom.Atom<AsyncResult.AsyncResult<string, string>> =>
  Atom.make(effect).pipe(
    Atom.serializable({
      key,
      schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
    }),
  );

describe("server atom resource hydration", () => {
  it("renders a resolved async atom and emits a package-prefixed hydratable key", async () => {
    const registry = AtomRegistry.make();
    const atom = serializableStringAtom("ssr-success", Effect.succeed("resolved"));

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom },
    });

    expect(rendered.body).toContain("resolved");
    expect(rendered.head).toContain(resourceHydrationKeyPrefix);
    expect(rendered.head).toContain("ssr-success");
    expect(rendered.head).toContain("dehydratedAt");
    registry.dispose();
  });

  it("captures dehydration time after an asynchronous result resolves", async () => {
    const registry = AtomRegistry.make();
    const atom = serializableStringAtom(
      "dehydration-time",
      Effect.promise(
        () => new Promise<string>((resolve) => setTimeout(() => resolve("resolved"), 10)),
      ),
    );

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom },
    });
    const timestamps = /timestamp:(\d+).*dehydratedAt:(\d+)/s.exec(rendered.head);

    expect(timestamps).not.toBeNull();
    expect(Number(timestamps?.[2])).toBeGreaterThanOrEqual(Number(timestamps?.[1]));
    registry.dispose();
  });

  it("hydrates a resource first read after an earlier resource await", async () => {
    const registry = AtomRegistry.make();
    const first = serializableStringAtom("sequential-first", Effect.succeed("first"));
    const second = serializableStringAtom("sequential-second", Effect.succeed("second"));

    const rendered = await render(SequentialHydratableResourceApp, {
      props: { registry, first, second },
    });

    expect(rendered.body).toContain("first");
    expect(rendered.body).toContain("second");
    expect(rendered.head).toContain("sequential-first");
    expect(rendered.head).toContain("sequential-second");
    registry.dispose();
  });

  it("uses a settled server override without executing the atom effect", async () => {
    const registry = AtomRegistry.make();
    let runs = 0;
    const atom = serializableStringAtom(
      "server-override",
      Effect.sync(() => {
        runs += 1;
        return "client";
      }),
    ).pipe(Atom.withServerValue(() => AsyncResult.success("server")));
    const subscribe = vi.spyOn(registry, "subscribe");

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom },
    });

    expect(rendered.body).toContain("server");
    expect(rendered.body).not.toContain("client");
    expect(rendered.head).toContain('value:"server"');
    expect(runs).toBe(0);
    expect(subscribe).not.toHaveBeenCalled();
    registry.dispose();
  });

  it("shares one server override result between resource instances", async () => {
    const registry = AtomRegistry.make();
    let reads = 0;
    const atom = serializableStringAtom("shared-server-override", Effect.succeed("client")).pipe(
      Atom.withServerValue(() => AsyncResult.success(`server-${++reads}`)),
    );

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom, twoUses: true },
    });

    expect(rendered.body.match(/server-1/g)).toHaveLength(2);
    expect(rendered.body).not.toContain("server-2");
    expect(rendered.head).toContain('value:"server-1"');
    expect(reads).toBe(1);
    registry.dispose();
  });

  it("does not execute or transfer an atom with an Initial server override", async () => {
    const registry = AtomRegistry.make();
    let runs = 0;
    const atom = serializableStringAtom(
      "browser-only",
      Effect.sync(() => {
        runs += 1;
        return "client";
      }),
    ).pipe(Atom.withServerValueInitial);
    const subscribe = vi.spyOn(registry, "subscribe");

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom },
      transformError: (error) => error,
    });

    expect(rendered.body).toContain("server value is Initial");
    expect(rendered.head).toContain("browser-only");
    expect(rendered.head).not.toContain('key:"browser-only"');
    expect(runs).toBe(0);
    expect(subscribe).not.toHaveBeenCalled();
    registry.dispose();
  });

  it("fulfills typed Failure transfer state before the resource rejects", async () => {
    const registry = AtomRegistry.make();
    const atom = serializableStringAtom("ssr-failure", Effect.fail("typed failure"));

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom },
      transformError: (error) => error,
    });

    expect(rendered.body).toContain("typed failure");
    expect(rendered.head).toContain("ssr-failure");
    expect(rendered.head).toContain("Failure");
    registry.dispose();
  });

  it("shares one server transfer between two resource uses", async () => {
    const registry = AtomRegistry.make();
    const subscribe = vi.spyOn(registry, "subscribe");
    const atom = serializableStringAtom("shared-transfer", Effect.succeed("shared"));

    const rendered = await render(HydratableResourceApp, {
      props: { registry, atom, twoUses: true },
    });

    expect(rendered.body.match(/shared/g)).toHaveLength(2);
    expect(rendered.head.split(resourceHydrationKeyPrefix)).toHaveLength(2);
    expect(subscribe).not.toHaveBeenCalled();
    registry.dispose();
  });

  it("creates fresh transfer state when an external registry is rendered again", async () => {
    const registry = AtomRegistry.make();
    const atom = Atom.make<AsyncResult.AsyncResult<string, string>>(
      AsyncResult.success("first"),
    ).pipe(
      Atom.serializable({
        key: "repeated-render",
        schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
      }),
    );

    const first = await render(HydratableResourceApp, {
      props: { registry, atom },
    });
    registry.set(atom, AsyncResult.success("second"));
    const second = await render(HydratableResourceApp, {
      props: { registry, atom },
    });

    expect(first.body).toContain("first");
    expect(first.head).toContain('value:"first"');
    expect(second.body).toContain("second");
    expect(second.head).toContain('value:"second"');
    registry.dispose();
  });

  it("rejects different atom objects that use one serialization key", async () => {
    const registry = AtomRegistry.make();
    const first = serializableStringAtom("duplicate-key", Effect.succeed("first"));
    const second = serializableStringAtom("duplicate-key", Effect.succeed("second"));

    await expect(
      render(DuplicateHydrationKeyApp, {
        props: { registry, first, second },
      }),
    ).rejects.toThrow("Duplicate Effect Atom serialization key");
    registry.dispose();
  });

  it("detects a serialization collision in existing registry nodes", async () => {
    const registry = AtomRegistry.make();
    const first = serializableStringAtom("existing-key", Effect.succeed("first"));
    const second = serializableStringAtom("existing-key", Effect.succeed("second"));
    registry.get(first);

    await expect(
      render(HydratableResourceApp, {
        props: { registry, atom: second },
      }),
    ).rejects.toThrow("Duplicate Effect Atom serialization key");
    registry.dispose();
  });

  it("releases a pending server wait when the render fails", async () => {
    const registry = AtomRegistry.make();
    const neverQuery: Effect.Effect<string, string> = Effect.never;
    const atom = Atom.make(neverQuery);

    await expect(render(FailingSiblingApp, { props: { registry, atom } })).rejects.toThrow(
      "sibling failure",
    );
    await new Promise((done) => setTimeout(done, 0));

    const node = Array.from(registry.getNodes().values()).find((entry) => entry.atom === atom);
    expect(node?.listeners.size ?? 0).toBe(0);
    registry.dispose();
  });

  it("rejects one serialization key used by different atoms in separate providers", async () => {
    const registry = AtomRegistry.make();
    const makeStaticAtom = (value: string) =>
      Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.success(value)).pipe(
        Atom.serializable({
          key: "shared-registry-key",
          schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
        }),
      );

    await expect(
      render(TwoProvidersDuplicateKeyApp, {
        props: { registry, first: makeStaticAtom("first"), second: makeStaticAtom("second") },
      }),
    ).rejects.toThrow("Duplicate Effect Atom serialization key");
    registry.dispose();
  });

  it("separates hydration keys of separately rendered roots by hydrationScope", async () => {
    const atomA = serializableStringAtom("multi-root", Effect.succeed("first-root"));
    const atomB = serializableStringAtom("multi-root", Effect.succeed("second-root"));
    const registryA = AtomRegistry.make();
    const registryB = AtomRegistry.make();

    const first = await render(HydratableResourceApp, {
      props: { registry: registryA, atom: atomA, hydrationScope: "root-a" },
    });
    const second = await render(HydratableResourceApp, {
      props: { registry: registryB, atom: atomB, hydrationScope: "root-b" },
    });

    expect(first.head).toContain("root-a");
    expect(first.head).not.toContain("root-b");
    expect(second.head).toContain("root-b");
    registryA.dispose();
    registryB.dispose();
  });

  it("keeps owned provider registries isolated between SSR requests", async () => {
    let runs = 0;
    const atom = serializableStringAtom(
      "request-isolation",
      Effect.sync(() => String(++runs)),
    );

    const [first, second] = await Promise.all([
      render(HydratableResourceApp, { props: { atom } }),
      render(HydratableResourceApp, { props: { atom } }),
    ]);

    expect([first.body, second.body].filter((body) => body.includes(">1<"))).toHaveLength(1);
    expect([first.body, second.body].filter((body) => body.includes(">2<"))).toHaveLength(1);
    expect(runs).toBe(2);
  });
});
