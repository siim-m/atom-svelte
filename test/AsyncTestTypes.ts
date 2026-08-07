import type * as Atom from "effect/unstable/reactivity/Atom";
import type { AtomPromiseExitSet, AtomPromiseSet } from "../src/index.ts";

export type AsyncTestRequest =
  | { readonly kind: "success"; readonly value: Promise<string> }
  | { readonly kind: "failure" }
  | { readonly kind: "never" };

export type AsyncTestWrite = AsyncTestRequest | Atom.Reset | Atom.Interrupt;

export interface AsyncTestPromiseApi {
  readonly promise: AtomPromiseSet<string, AsyncTestWrite>;
  readonly promiseExit: AtomPromiseExitSet<string, string, AsyncTestWrite>;
}
