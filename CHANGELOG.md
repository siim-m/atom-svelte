# Changelog

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1-alpha.5] - 2026-10-12

### Changed

- **Breaking:** setters are now plain functions, as in Effect's React, Vue, and Solid bindings.
  `useAtomSet` returns the setter itself. `useAtom` returns `{ current, set }`, and `set` takes a
  value or an updater function. `update` is removed: write `set((value) => next)`.
- **Breaking:** a setter for an atom whose write type includes a function accepts only updaters,
  because a function argument is an updater. To store a function, assign `current` or write
  `set(() => fn)`.
- **Breaking:** promise-mode and promise-exit-mode setters no longer accept `Atom.Reset`. A reset
  left the returned promise pending.
- **Breaking:** renamed the setter types. `AtomValueSet`, `AtomPromiseSet`, and
  `AtomPromiseExitSet` are now `AtomValueSetter`, `AtomPromiseSetter`, and `AtomPromiseExitSetter`.
  `AtomSet` is now `AtomSetter`.

### Added

- `useAtom` has an assignable `current` when every value the atom reads can be written back, so
  `bind:value={query.current}` and `query.current = next` write the atom. Before, `bind:` passed
  type checking and then threw on the first input. The binding type is `WritableAtomBinding`.
- Assigning `current` on a promise-mode `useAtom` binding throws an error that names the mode and
  points to `set`.

## [0.0.1-alpha.4] - 2026-10-12

### Fixed

- A serializable atom read through `useAtomResource` can now be garbage collected after its registry
  evicts it. Before, the package held every such atom for the registry's lifetime, so idle-TTL
  eviction never freed `Atom.family` members and a long-lived browser registry grew with every key
  it read. Reading two different live atoms under one serialization key still throws.
- A browser registry no longer keeps a hydration entry for every resource key it reads without a
  server transfer.

## [0.0.1-alpha.3] - 2026-10-09

### Changed

- Updated the development dependency to Effect `4.0.2`. The peer dependency range stays `^4.0.0`.

### Fixed

- `useAtomResource` no longer re-runs an awaiting reaction when it mounts against, or switches to,
  an atom that already holds a result. During client navigation, the extra re-run could trigger
  Svelte's development invariant `Batch has scheduled roots`.
- A reader that resumed before its resource subscription connected no longer keeps an older result
  after the atom changes.
- A `RegistryProvider` that remounts with the same registry no longer applies the first page
  load's server values over newer data.
- A resource whose atom threw while it connected now retries on its next read. Before, every later
  read rejected until the component remounted.

## [0.0.1-alpha.2] - 2026-10-03

### Changed

- Updated the development dependency to Effect `4.0.0` and the peer dependency range to `^4.0.0`.
- Imported the Atom modules from `effect/reactivity/*`, which replaces the removed
  `effect/unstable/reactivity/*` export paths.
- Used the `~effect/reactivity/Hydration/DehydratedAtom` marker from Effect `4.0.0` in transferred
  resource state.

## [0.0.1-alpha.1] - 2026-08-27

### Changed

- Updated the development and peer dependencies to Effect `4.0.0-rc.112`.
- Migrated the RPC test fixture to the Effect v4 RC tagged error API.

## [0.0.1-alpha.0] - 2026-08-07

### Added

- Svelte 5 bindings for Effect Atom values, writable atoms, and atom refs.
- Awaitable bindings for Effect `AsyncResult` atoms.
- Server rendering and automatic Svelte hydration for serializable resources.
- Scoped registries, hydration boundaries, and scoped atom contexts.

[Unreleased]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.5...HEAD
[0.0.1-alpha.5]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.4...v0.0.1-alpha.5
[0.0.1-alpha.4]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.3...v0.0.1-alpha.4
[0.0.1-alpha.3]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.2...v0.0.1-alpha.3
[0.0.1-alpha.2]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.1...v0.0.1-alpha.2
[0.0.1-alpha.1]: https://github.com/siim-m/atom-svelte/compare/0f8e0039d7ee270b3ac5c5a572260979585e0d88...v0.0.1-alpha.1
[0.0.1-alpha.0]: https://github.com/siim-m/atom-svelte/releases/tag/v0.0.1-alpha.0
