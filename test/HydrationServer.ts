import { render } from "svelte/server";
import BrowserOnlyHydrationRoundTripApp from "./BrowserOnlyHydrationRoundTripApp.svelte";
import type { HydrationProps, SequentialHydrationProps } from "./HydrationHarness.ts";
import HydrationRoundTripApp from "./HydrationRoundTripApp.svelte";
import SequentialHydratableResourceApp from "./SequentialHydratableResourceApp.svelte";

export const renderApp = (props: HydrationProps) => render(HydrationRoundTripApp, { props });

export const renderBrowserOnlyApp = (props: HydrationProps) =>
  render(BrowserOnlyHydrationRoundTripApp, { props });

export const renderSequentialApp = (props: SequentialHydrationProps) =>
  render(SequentialHydratableResourceApp, { props });
