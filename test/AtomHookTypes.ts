import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import {
  useAtom,
  useAtomSet,
  type AtomValueSetter,
  type WritableAtomBinding,
} from "../src/index.ts";

declare const countAtom: Atom.Writable<number>;
declare const widenedAtom: Atom.Writable<number, number | string>;
declare const narrowedAtom: Atom.Writable<string, number>;
declare const functionAtom: Atom.Writable<() => string>;
// An untyped atom must still accept plain values.
// oxlint-disable-next-line typescript/no-explicit-any
declare const untypedAtom: Atom.Writable<any, any>;
declare const mutationAtom: Atom.AtomResultFn<number, string>;
declare const initial: AsyncResult.AsyncResult<string>;

/** svelte-check verifies these call sites. Nothing calls this function. */
export const hookTypeChecks = (): void => {
  const count = useAtom(countAtom);
  count.current = 2;
  count.set(3);
  count.set((value) => value + 1);

  const widened = useAtom(widenedAtom);
  widened.current = "text";
  widened.set("text");
  widened.set((value) => value + 1);

  const sharedSetter: AtomValueSetter<number, number | string> = widened.set;
  const mountedSetter: typeof widened.set = useAtomSet(widenedAtom);
  void sharedSetter;
  void mountedSetter;

  const narrowed = useAtom(narrowedAtom);
  // @ts-expect-error A string read cannot be written back to a number writer.
  narrowed.current = 1;
  narrowed.set(1);

  // @ts-expect-error A writable current must be able to write back every value it reads.
  const unsound: WritableAtomBinding<string, number> | undefined = undefined;
  void unsound;

  const mutation = useAtom(mutationAtom);
  // @ts-expect-error An atom whose read and write types differ has a read-only current.
  mutation.current = initial;
  mutation.set(1);

  const setFunction = useAtomSet(functionAtom);
  // @ts-expect-error A function argument is an updater, so it must return the stored function.
  setFunction(() => "stored");
  setFunction(() => () => "stored");

  useAtomSet(untypedAtom)(1);

  const runMutation = useAtomSet(mutationAtom, { mode: "promise" });
  // @ts-expect-error Atom.Reset would leave the returned promise pending.
  void runMutation(Atom.Reset);
  void runMutation(Atom.Interrupt);
  void runMutation(1);

  const runMutationExit = useAtomSet(mutationAtom, { mode: "promiseExit" });
  // @ts-expect-error Atom.Reset would leave the returned promise pending.
  void runMutationExit(Atom.Reset);

  const mutationBinding = useAtom(mutationAtom, { mode: "promise" });
  // @ts-expect-error A promise-mode binding has a read-only current.
  mutationBinding.current = initial;
};
