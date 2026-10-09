import { browser } from "$app/environment";
import { browserRegistry } from "$lib/registry.ts";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = () => ({
  registry: browser ? browserRegistry() : AtomRegistry.make(),
});
