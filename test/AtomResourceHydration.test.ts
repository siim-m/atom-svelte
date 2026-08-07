import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { useHydrationHarness } from "./HydrationHarness.ts";
import { pollUntil } from "./Poll.ts";
import { text } from "./TestDom.ts";

describe("atom resource hydration round trip", () => {
  const harness = useHydrationHarness();

  it("hydrates immediate, sequential, and client-only resources without duplicate execution", async () => {
    const { client, server } = harness;
    let runs = 0;
    const query: Effect.Effect<string, string> = Effect.sync(() => String(++runs));
    const atom = Atom.make(query).pipe(
      Atom.serializable({
        key: "round-trip",
        schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
      }),
    );
    const serverRegistry = AtomRegistry.make();

    try {
      const rendered = await server.renderApp({ registry: serverRegistry, atom });
      expect(rendered.body).toContain("1");
      expect(runs).toBe(1);

      harness.load(rendered);
      const serverElement = document.querySelector('[data-testid="resource-first"]');
      expect(serverElement).not.toBeNull();
      // The generated Svelte script installs this hydration map.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const hydrationState = Reflect.get(window, "__svelte") as {
        readonly h: Map<string, Promise<unknown>>;
      };
      expect(hydrationState.h.size).toBe(1);
      await expect(Array.from(hydrationState.h.values())[0]).resolves.toMatchObject({
        key: "round-trip",
      });

      const clientRegistry = AtomRegistry.make();
      const getClientNode = () =>
        Array.from(clientRegistry.getNodes().values()).find((node) => node.atom === atom);
      const component = client.hydrateApp(document.body, {
        registry: clientRegistry,
        atom,
      });
      await client.settled();

      await pollUntil(
        () => getClientNode()?.listeners.size === 1,
        async () => {
          client.flushSync();
          await client.tick();
          await new Promise((done) => setTimeout(done, 0));
        },
      );
      expect(text("resource-first")).toBe("1");
      expect(document.querySelector('[data-testid="resource-first"]')).toBe(serverElement);
      expect(runs).toBe(1);
      expect(getClientNode()?.listeners.size).toBe(1);

      clientRegistry.refresh(atom);
      await pollUntil(
        () => text("resource-first") === "2",
        async () => {
          client.flushSync();
          await client.tick();
          await new Promise((done) => setTimeout(done, 0));
        },
      );
      expect(runs).toBe(2);
      expect(text("resource-first")).toBe("2");

      await client.unmount(component);
      clientRegistry.dispose();

      let sequentialFirstRuns = 0;
      let sequentialSecondRuns = 0;
      const sequentialFirstQuery: Effect.Effect<string, string> = Effect.sync(() => {
        sequentialFirstRuns += 1;
        return "first";
      });
      const sequentialSecondQuery: Effect.Effect<string, string> = Effect.sync(() => {
        sequentialSecondRuns += 1;
        return "second";
      });
      const sequentialFirst = Atom.make(sequentialFirstQuery).pipe(
        Atom.serializable({
          key: "sequential-round-trip-first",
          schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
        }),
      );
      const sequentialSecond = Atom.make(sequentialSecondQuery).pipe(
        Atom.serializable({
          key: "sequential-round-trip-second",
          schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
        }),
      );
      const sequentialServerRegistry = AtomRegistry.make();
      const sequentialClientRegistry = AtomRegistry.make();
      try {
        const sequentialRendered = await server.renderSequentialApp({
          registry: sequentialServerRegistry,
          first: sequentialFirst,
          second: sequentialSecond,
        });
        expect(sequentialFirstRuns).toBe(1);
        expect(sequentialSecondRuns).toBe(1);

        harness.load(sequentialRendered);
        const sequentialSecondElement = document.querySelector('[data-testid="sequential-second"]');
        expect(sequentialSecondElement).not.toBeNull();
        // The generated Svelte script installs this hydration map.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const sequentialState = Reflect.get(window, "__svelte") as {
          readonly h: Map<string, Promise<unknown>>;
        };
        expect(sequentialState.h.size).toBe(2);

        const sequentialComponent = client.hydrateSequentialApp(document.body, {
          registry: sequentialClientRegistry,
          first: sequentialFirst,
          second: sequentialSecond,
        });
        await client.settled();

        expect(text("sequential-first")).toBe("first");
        expect(text("sequential-second")).toBe("second");
        expect(document.querySelector('[data-testid="sequential-second"]')).toBe(
          sequentialSecondElement,
        );
        expect(sequentialFirstRuns).toBe(1);
        expect(sequentialSecondRuns).toBe(1);
        await client.unmount(sequentialComponent);
      } finally {
        sequentialClientRegistry.dispose();
        sequentialServerRegistry.dispose();
      }

      let browserOnlyRuns = 0;
      const browserOnlyQuery: Effect.Effect<string, string> = Effect.sync(() => {
        browserOnlyRuns += 1;
        return "browser";
      });
      const browserOnlyAtom = Atom.make(browserOnlyQuery).pipe(
        Atom.serializable({
          key: "browser-only-round-trip",
          schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
        }),
        Atom.withServerValueInitial,
      );
      const browserOnlyServerRegistry = AtomRegistry.make();
      const browserOnlyClientRegistry = AtomRegistry.make();
      try {
        const browserOnlyRendered = await server.renderBrowserOnlyApp({
          registry: browserOnlyServerRegistry,
          atom: browserOnlyAtom,
        });
        expect(browserOnlyRendered.body).toContain("pending");
        expect(browserOnlyRendered.head).not.toContain("browser-only-round-trip");
        expect(browserOnlyRuns).toBe(0);

        harness.load(browserOnlyRendered);
        const browserOnlyComponent = client.hydrateBrowserOnlyApp(document.body, {
          registry: browserOnlyClientRegistry,
          atom: browserOnlyAtom,
        });
        await pollUntil(
          () => text("browser-only-resource") === "browser",
          async () => {
            client.flushSync();
            await client.settled();
            await new Promise((done) => setTimeout(done, 0));
          },
        );

        expect(text("browser-only-resource")).toBe("browser");
        expect(browserOnlyRuns).toBe(1);
        await client.unmount(browserOnlyComponent);
      } finally {
        browserOnlyClientRegistry.dispose();
        browserOnlyServerRegistry.dispose();
      }
    } finally {
      serverRegistry.dispose();
    }
  });
});
