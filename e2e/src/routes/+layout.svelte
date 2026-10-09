<script lang="ts">
  import { browser } from "$app/environment";
  import { markInitialHydrationDone } from "$lib/registry.ts";
  import { RegistryProvider } from "@siim-m/atom-svelte";
  import { onDestroy, onMount } from "svelte";
  import type { LayoutProps } from "./$types";

  const { data, children }: LayoutProps = $props();

  // Mark it synchronously, as the app this suite models does. Loads that start later are client
  // navigations, which run after the page has hydrated the registry.
  if (browser) {
    markInitialHydrationDone();
  }

  // Lets the tests wait for hydration before they click links.
  onMount(() => {
    document.documentElement.dataset.hydrated = "";
  });

  onDestroy(() => {
    if (!browser) {
      data.registry.dispose();
    }
  });
</script>

<nav>
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
<RegistryProvider
  registry={data.registry}
  hydrationScope="main"
>
  {@render children()}
</RegistryProvider>
