import type * as Atom from "effect/unstable/reactivity/Atom";
import { makeScopedAtomContext } from "../src/index.ts";

export const [getScopedAtom, setScopedAtom] = makeScopedAtomContext<Atom.Atom<number>>();
