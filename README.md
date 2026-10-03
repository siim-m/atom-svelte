# `@siim-m/atom-svelte`

Svelte 5 bindings for the Atom modules in `effect/reactivity`.

> **Status: early alpha.** The API can change between releases.

## Setup

Plain atom bindings work without Svelte experimental async. This includes `useAtomValue` and the
latest-value stream recipe below. Enable experimental async for the async-resource and automatic
hydration features. Svelte `hydratable` throws an error if this option is disabled.

```js
// svelte.config.js
export default {
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
};
```

Import:

- Svelte bindings from `@siim-m/atom-svelte`.
- `Atom`, `AsyncResult`, `AtomRegistry`, and other Effect modules from `effect`.

```ts
import * as Atom from "effect/reactivity/Atom";
```

Put one `RegistryProvider` above all components that use the bindings.

```svelte
<script>
  import { RegistryProvider } from "@siim-m/atom-svelte";
  import App from "./App.svelte";
</script>

<RegistryProvider>
  <App />
</RegistryProvider>
```

For SSR:

- Create one registry for each request.
- Keep the registry inside the request component tree.
- A provider disposes a registry that it creates.
- A provider does not dispose a registry that you supply.

## API

- `RegistryProvider`, `getAtomRegistry` — provide and read a registry.
- `useAtomValue`, `useAtom`, `useAtomSet` — read and write atoms.
- `useAtomResource` — make an `AsyncResult` atom awaitable.
- `useAtomMount`, `useAtomRefresh`, `useAtomSubscribe` — control an atom lifecycle.
- `useAtomRef`, `useAtomRefProp`, `useAtomRefPropValue` — bind to `AtomRef` values.
- `HydrationBoundary` — apply registry hydration state.
- `makeScopedAtomContext` — share one atom through Svelte context.
- `fromAtom`, `fromAtomRef`, `resolveAtom`, `resolveAtomRef` — low-level adapters.

## Latest-value RPC streams

Use a latest-value stream for an open-ended RPC feed. Use it when the UI needs only the newest
emission. Compose the RPC stream with public Effect Atom primitives. Then read the ordinary atom
with `useAtomValue`. `atom-svelte` does not add a stream-specific API.

```ts
// Atoms.ts
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Atom from "effect/reactivity/Atom";
import { Client } from "./RpcClient.ts";

export const latestCountAtom = Client.runtime
  .atom(
    Stream.unwrap(
      Client.use((client) =>
        Effect.succeed(
          client("WatchCount", { source: "dashboard" }, { headers: { authorization: "..." } }),
        ),
      ),
    ),
  )
  .pipe(Atom.setIdleTTL(0), Atom.withServerValueInitial);
```

```svelte
<script lang="ts">
  import { useAtomValue } from "@siim-m/atom-svelte";
  import { latestCountAtom } from "./Atoms.ts";

  const count = useAtomValue(latestCountAtom);
</script>

{#if count.current._tag === "Success"}
  <p>{count.current.value}</p>
{/if}
```

This path consumes the RPC stream continuously while it has a consumer. The atom retains only the
latest emission. A `Success(value, { waiting: true })` is usable state. `waiting: true` means that the
stream is open. It does not mean that the value is unavailable. `Atom.setIdleTTL(0)` interrupts the
underlying stream when the final consumer detaches. Effect schedules this cleanup.

`Atom.withServerValueInitial` makes the stream client-only. SSR reads `Initial(waiting: true)`. SSR
does not start the infinite RPC. The browser starts the RPC when the component mounts. A stream
failure produces an `AsyncResult.Failure`. Its `previousSuccess` retains the latest value. The atom
does not retry automatically. Put the retry policy in the source stream or RPC layer. A non-empty
finite stream completes as `Success(lastValue, { waiting: false })`. An empty stream fails with
`NoSuchElementError`.

Use `AtomRpc.query` for a pull stream. Consumer writes advance this stream, and it can retain multiple
emissions. Do not write to that pull atom automatically to model latest-value state.

## Async resources

`useAtomResource` returns a reactive object. Its `current` value is a `Promise`.

```svelte
<script lang="ts">
  import { useAtomResource } from "@siim-m/atom-svelte";
  import { countAtom } from "./Atoms.ts";

  const resource = useAtomResource(countAtom);
  const count = $derived(await resource.current);
</script>

<p>{count}</p>
```

Options and behavior:

- Use `$derived(await resource.current)` for reactive updates.
- Top-level component `await` is also supported.
- A refresh keeps the last success visible by default.
- Set `suspendOnWaiting: true` to wait for a settled, non-waiting result.
- A typed failure rejects with `Cause.squash` by default.
- Use a `<svelte:boundary>` to handle a rejected async expression.
- Set `includeFailure: true` to resolve with `AsyncResult.Success` or `AsyncResult.Failure`.

A thunk input must return a stable atom:

- Use `Atom.family` for parameterized atoms.
- Return the same atom object for the same logical input.

## Automatic SSR hydration

A serializable `AsyncResult` atom uses Svelte `hydratable` to transfer its server state.

Flow:

1. The server starts the atom and waits for a settled result.
2. The server renders and serializes the result.
3. The client hydrates the registry before its first read.
4. The initial query does not run again on the client.
5. A later refresh starts a new query.

Server values:

- `Atom.withServerValue` supplies a settled server value without running the atom effect.
- `Atom.withServerValueInitial` makes a resource client-only.
- Put a client-only resource in a `<svelte:boundary>` with a `pending` snippet.

Serialization keys:

- Use a stable and unique key for each logical atom value.
- For `Atom.serializable`, use an `AsyncResult.Schema` codec.
- For `AtomRpc` and `AtomHttpApi`, set a stable `serializationKey`.
- One registry cannot use the same key for different atom objects.

Other rules:

- A non-serializable atom has no automatic state transfer.
- Use a unique Svelte `idPrefix` or provider `hydrationScope` for each separately rendered root.
- For a strict Content Security Policy, give Svelte `render` a nonce or request script hashes.
- Use `RegistryProvider.dehydratedState` or `HydrationBoundary` for general registry hydration.
- Do not pass promise-mode `Hydration.dehydrate` output through Svelte `hydratable`.
