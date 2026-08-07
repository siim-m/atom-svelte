import { flushSync, hydrate, settled, tick, unmount } from "svelte";
import BrowserOnlyHydrationRoundTripApp from "./BrowserOnlyHydrationRoundTripApp.svelte";
import type { HydrationProps, SequentialHydrationProps } from "./HydrationHarness.ts";
import HydrationRoundTripApp from "./HydrationRoundTripApp.svelte";
import SequentialHydratableResourceApp from "./SequentialHydratableResourceApp.svelte";

export const hydrateApp = (target: Element, props: HydrationProps): object =>
  hydrate(HydrationRoundTripApp, { target, props });

export const hydrateBrowserOnlyApp = (target: Element, props: HydrationProps): object =>
  hydrate(BrowserOnlyHydrationRoundTripApp, { target, props });

export const hydrateSequentialApp = (target: Element, props: SequentialHydrationProps): object =>
  hydrate(SequentialHydratableResourceApp, { target, props });

export { flushSync, settled, tick, unmount };
