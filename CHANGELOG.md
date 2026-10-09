# Changelog

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1-alpha.3] - 2026-10-09

### Fixed

- `useAtomResource` no longer re-runs an awaiting reaction when it mounts against, or switches to,
  an atom that already holds a result. During client navigation, the extra re-run could trigger
  Svelte's development invariant `Batch has scheduled roots`.
- A reader that resumed before its resource subscription connected no longer keeps an older result
  after the atom changes.

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

[Unreleased]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.3...HEAD
[0.0.1-alpha.3]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.2...v0.0.1-alpha.3
[0.0.1-alpha.2]: https://github.com/siim-m/atom-svelte/compare/v0.0.1-alpha.1...v0.0.1-alpha.2
[0.0.1-alpha.1]: https://github.com/siim-m/atom-svelte/compare/0f8e0039d7ee270b3ac5c5a572260979585e0d88...v0.0.1-alpha.1
[0.0.1-alpha.0]: https://github.com/siim-m/atom-svelte/releases/tag/v0.0.1-alpha.0
