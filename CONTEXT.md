# Domain context

## Stream consumption modes

- **Latest-value stream**: an asynchronous state source. It consumes values continuously and retains
  only the most recent emission.
- **Pull stream**: a demand-driven stream. A consumer action advances it, and it can retain multiple
  emissions.

Use these terms in code, tests, and documentation. Do not use `streaming query` by itself. Do not use
`live query`.
