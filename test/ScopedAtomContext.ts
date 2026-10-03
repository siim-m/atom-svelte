import type * as Atom from "effect/reactivity/Atom";
import { makeScopedAtomContext } from "../src/index.ts";

export const [getScopedAtom, setScopedAtom] = makeScopedAtomContext<Atom.Atom<number>>();
