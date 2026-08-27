# Domain context

## Stream consumption modes

- **Latest-value stream**: continuously consumed asynchronous state retaining only the most recent
  emission.
- **Pull stream**: demand-driven streaming advanced by consumer action and capable of retaining
  multiple emissions.

Use these qualified terms in code, tests, and documentation. Avoid the ambiguous standalone term
“streaming query”; “live query” is also not canonical.
