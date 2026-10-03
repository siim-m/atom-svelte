<!-- @component Provides an atom registry to a Svelte component subtree. -->
<script lang="ts">
  import { DEV } from "esm-env";
  import * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import type * as Hydration from "effect/reactivity/Hydration";
  import { onDestroy, type Snippet, untrack } from "svelte";
  import { setRegistryContext } from "./RegistryContext.ts";
  import { hydrateRegistry, makeResourceHydration } from "./ResourceHydration.ts";

  type RegistryOptions = NonNullable<Parameters<typeof AtomRegistry.make>[0]>;

  interface CommonProps {
    readonly children?: Snippet | undefined;
    readonly dehydratedState?: Iterable<Hydration.DehydratedAtom> | undefined;
    /**
     * Distinguishes the `hydratable` keys of this provider from other server
     * rendered roots. Svelte scope ids are unique only inside one `render`
     * call. Set a distinct value on each provider when one page hydrates more
     * than one server rendered root without distinct render `idPrefix` values.
     */
    readonly hydrationScope?: string | undefined;
  }

  interface ExternalRegistryProps {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly initialValues?: never;
    readonly scheduleTask?: never;
    readonly timeoutResolution?: never;
    readonly defaultIdleTTL?: never;
  }

  interface OwnedRegistryProps {
    readonly registry?: undefined;
    readonly initialValues?: RegistryOptions["initialValues"];
    readonly scheduleTask?: RegistryOptions["scheduleTask"];
    readonly timeoutResolution?: RegistryOptions["timeoutResolution"];
    readonly defaultIdleTTL?: RegistryOptions["defaultIdleTTL"];
  }

  type Props = CommonProps & (ExternalRegistryProps | OwnedRegistryProps);

  const generatedScopeId = $props.id();
  const {
    children,
    registry: externalRegistry,
    initialValues,
    scheduleTask,
    timeoutResolution,
    defaultIdleTTL,
    dehydratedState,
    hydrationScope,
  }: Props = $props();
  const hydrationScopeId = untrack(() => hydrationScope) ?? generatedScopeId;

  const { ownsRegistry, registry } = untrack(() => ({
    ownsRegistry: externalRegistry === undefined,
    registry:
      externalRegistry ??
      AtomRegistry.make({
        initialValues,
        scheduleTask,
        timeoutResolution,
        defaultIdleTTL,
      }),
  }));

  if (DEV) {
    const initialExternalRegistry = untrack(() => externalRegistry);
    $effect(() => {
      if (externalRegistry !== initialExternalRegistry) {
        console.warn(
          "RegistryProvider ignores a registry prop change after setup. Recreate the provider with a {#key} block to use a different registry.",
        );
      }
    });
  }

  const resourceHydration = makeResourceHydration(hydrationScopeId, registry);

  untrack(() => {
    if (dehydratedState !== undefined) {
      hydrateRegistry(registry, dehydratedState);
    }
  });

  const resourceCleanups = new Set<() => void>();
  const registerResourceCleanup = (cleanup: () => void): (() => void) => {
    resourceCleanups.add(cleanup);
    return () => resourceCleanups.delete(cleanup);
  };
  setRegistryContext({ registry, resourceHydration, registerResourceCleanup });

  onDestroy(() => {
    for (const cleanup of resourceCleanups) {
      cleanup();
    }
    resourceCleanups.clear();
    if (ownsRegistry) {
      registry.dispose();
    }
  });
</script>

{@render children?.()}
