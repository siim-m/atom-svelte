import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { AtomBinding, AtomPromiseExitSetter } from "../src/index.ts";

export type AsyncTestRequest =
  | { readonly kind: "success"; readonly value: Promise<string> }
  | { readonly kind: "failure" }
  | { readonly kind: "never" };

export type AsyncTestWrite = AsyncTestRequest | Atom.Reset | Atom.Interrupt;

export interface AsyncTestPromiseApi {
  readonly promise: AtomBinding<AsyncResult.AsyncResult<string, string>, AsyncTestWrite, "promise">;
  readonly promiseExit: AtomPromiseExitSetter<string, string, AsyncTestWrite>;
}
