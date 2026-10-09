import { browser } from "$app/environment";
import { settleAtoms } from "$lib/atoms.ts";
import { browserRegistry, isInitialHydrationDone } from "$lib/registry.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // Skip the initial hydration load: the registry receives the server state only when the page
  // hydrates, so settling here would run every atom in the browser.
  if (browser && isInitialHydrationDone()) {
    await settleAtoms(browserRegistry());
  }
};
