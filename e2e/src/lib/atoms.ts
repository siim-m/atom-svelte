import { browser } from "$app/environment";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { recordAtomRun } from "./probe.ts";

const resultSchema = AsyncResult.Schema({ success: Schema.String, error: Schema.String });

/** A serializable atom whose value tells where it ran: `a:server` or `a:client:<browser run>`. */
const makeAtom = (name: string): Atom.Atom<AsyncResult.AsyncResult<string, string>> => {
  let browserRuns = 0;
  const query: Effect.Effect<string, string> = Effect.gen(function* () {
    let value = `${name}:server`;
    if (browser) {
      browserRuns += 1;
      recordAtomRun(name);
      value = `${name}:client:${browserRuns}`;
    }
    yield* Effect.sleep("5 millis");
    return value;
  });
  return Atom.make(query).pipe(
    Atom.serializable({ key: `e2e:${name}`, schema: resultSchema }),
    Atom.keepAlive,
  );
};

export const atoms = {
  a: makeAtom("a"),
  b: makeAtom("b"),
  c: makeAtom("c"),
  d: makeAtom("d"),
};

/** Resolves once every atom holds a settled result. */
export const settleAtoms = (registry: AtomRegistry.AtomRegistry): Promise<void> =>
  Effect.runPromise(
    Effect.forEach(
      Object.values(atoms),
      (atom) =>
        Effect.suspend(() =>
          AsyncResult.isSuccess(registry.get(atom))
            ? Effect.void
            : Effect.ignore(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true })),
        ),
      { concurrency: "unbounded", discard: true },
    ),
  );
