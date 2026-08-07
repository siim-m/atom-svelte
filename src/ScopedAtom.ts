import type * as Atom from "effect/unstable/reactivity/Atom";
import { createContext } from "svelte";

/** Creates typed get and set functions for an atom scoped to a component subtree. */
export const makeScopedAtomContext = <A extends Atom.Atom<unknown>>() => {
  const [getContext, setContext] = createContext<A | undefined>();

  const getAtom = (): A => {
    const atom = getContext();
    if (atom === undefined) {
      throw new Error("Scoped atom used outside its context");
    }
    return atom;
  };

  const setAtom = (atom: A): A => {
    setContext(atom);
    return atom;
  };

  return [getAtom, setAtom] as const;
};
