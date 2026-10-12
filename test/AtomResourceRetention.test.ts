import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { makeResourceHydration, type ResourceHydration } from "../src/ResourceHydration.ts";
import HydratableResourceApp from "./HydratableResourceApp.svelte";
import { flushStep, pollUntil } from "./Poll.ts";
import { text } from "./TestDom.ts";

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(window, "__svelte");
});

type SeriesAtom = Atom.Atom<AsyncResult.AsyncResult<string, string>>;

const resultSchema = AsyncResult.Schema({ success: Schema.String, error: Schema.String });

/** Series atoms keyed by company, read the way an app reads one page's data. */
const makeSeriesFamily = (): ((company: string) => SeriesAtom) =>
  Atom.family((company: string) => {
    const query: Effect.Effect<string, string> = Effect.succeed(`series of ${company}`);
    return Atom.make(query).pipe(
      Atom.serializable({ key: `series:${company}`, schema: resultSchema }),
      Atom.setIdleTTL(20),
    );
  });

/** A long-lived browser registry that evicts idle atoms within a few milliseconds. */
const makeRegistry = (): AtomRegistry.AtomRegistry => AtomRegistry.make({ timeoutResolution: 10 });

const rendered = (): string | null => text("resource-first") ?? text("resource-failure");

/** Renders an atom through `useAtomResource` until it settles, then unmounts its reader. */
const readThroughResource = async (
  registry: AtomRegistry.AtomRegistry,
  atom: SeriesAtom,
): Promise<string | null> => {
  const component = mount(HydratableResourceApp, {
    target: document.body,
    props: { registry, atom },
  });
  await pollUntil(() => rendered() !== null, flushStep);
  const result = rendered();
  await unmount(component);
  return result;
};

/**
 * Reads one family member and returns only a weak reference to it, so the caller's scope does not
 * keep the atom alive.
 */
const readMember = async (
  registry: AtomRegistry.AtomRegistry,
  family: (company: string) => SeriesAtom,
  company: string,
): Promise<{ readonly rendered: string | null; readonly member: WeakRef<SeriesAtom> }> => {
  const atom = family(company);
  return { rendered: await readThroughResource(registry, atom), member: new WeakRef(atom) };
};

const waitForEviction = (registry: AtomRegistry.AtomRegistry, key: string): Promise<void> =>
  pollUntil(
    () => !registry.getNodes().has(key),
    () => new Promise((done) => setTimeout(done, 10)),
  );

/**
 * Prepares a serializable resource that has no server transfer, as a client navigation does, and
 * returns only a weak reference to the preparation.
 */
const prepareWithoutTransfer = async (
  hydration: ResourceHydration,
  serializationKey: string,
  atom: SeriesAtom,
): Promise<WeakRef<Promise<void>>> => {
  const preparation = hydration.register(serializationKey, atom, () => Promise.resolve(undefined));
  await preparation;
  return new WeakRef(preparation);
};

/** Forces garbage collection until the condition holds or the attempt budget ends. */
const collectGarbage = async (collected: () => boolean): Promise<void> => {
  const { gc } = globalThis;
  if (gc === undefined) {
    throw new Error("Retention tests need Node's --expose-gc flag");
  }
  for (let attempt = 0; attempt < 10 && !collected(); attempt += 1) {
    // A WeakRef keeps its target alive until the current job ends.
    await new Promise((done) => setTimeout(done, 0));
    gc();
  }
};

describe("atom resource retention", () => {
  it("lets an evicted family atom be garbage collected", async () => {
    const registry = makeRegistry();
    const series = makeSeriesFamily();

    const { rendered: first, member } = await readMember(registry, series, "acme");
    expect(first).toBe("series of acme");

    await waitForEviction(registry, "series:acme");
    expect(registry.getNodes().has("series:acme")).toBe(false);

    await collectGarbage(() => member.deref() === undefined);
    expect(member.deref()).toBeUndefined();
    registry.dispose();
  });

  it("reads a family key again after its earlier atom was collected", async () => {
    const registry = makeRegistry();
    const series = makeSeriesFamily();
    const { member } = await readMember(registry, series, "acme");
    await waitForEviction(registry, "series:acme");
    await collectGarbage(() => member.deref() === undefined);
    // The family now creates a new atom object for the same key.
    expect(member.deref()).toBeUndefined();

    const { rendered: again } = await readMember(registry, series, "acme");
    expect(again).toBe("series of acme");
    registry.dispose();
  });

  it("rejects a different atom under the key of an evicted atom that is still alive", async () => {
    const registry = makeRegistry();
    const first = makeSeriesFamily()("acme");
    const second = makeSeriesFamily()("acme");
    expect(await readThroughResource(registry, first)).toBe("series of acme");
    await waitForEviction(registry, "series:acme");
    expect(registry.getNodes().has("series:acme")).toBe(false);

    expect(await readThroughResource(registry, second)).toContain(
      'Duplicate Effect Atom serialization key "series:acme"',
    );
    // Keeps the first atom reachable until the second read.
    expect(first).not.toBe(second);
    registry.dispose();
  });

  it("keeps no browser preparation for a key without a server transfer", async () => {
    const registry = makeRegistry();
    const hydration = makeResourceHydration("retention-scope", registry);
    const atom = makeSeriesFamily()("acme");

    const preparation = await prepareWithoutTransfer(hydration, "series:acme", atom);
    await collectGarbage(() => preparation.deref() === undefined);
    expect(preparation.deref()).toBeUndefined();
    registry.dispose();
  });
});
