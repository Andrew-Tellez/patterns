# patterns

Design patterns you can drop into real code — the
[Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) packaged as small
typed helpers instead of textbook class diagrams to copy by hand.

One package per language, each idiomatic to that language, same catalog and same names.

| Language | Package | Status |
| --- | --- | --- |
| TypeScript / JavaScript | [`@andrew-tellez/patterns`](packages/ts) — `npm i @andrew-tellez/patterns` | ✅ |
| Python | [`gof-patterns`](packages/py) — `pip install gof-patterns` | ✅ |
| Kotlin / Java | `packages/kotlin` | planned |
| C# | `packages/csharp` | planned |

Each package's README has the full catalog table, the helper names and examples:
[TypeScript](packages/ts/README.md) · [Python](packages/py/README.md).

## Principles

- **A helper must earn its place.** Where the language or its standard library already has
  the pattern, the README points at it instead of wrapping it: 5 patterns have no helper in
  TypeScript, 8 in Python (`functools.cache`, `copy.deepcopy`, `functools.singledispatch`…).
- **No dependencies**, in any language package.
- **The pattern's plumbing, not your domain.** You pass in the behaviour; the helper handles
  the bookkeeping (history stacks, listener sets, transition tables, caches).
- **Typed.** A state machine with no `ship` transition fails at the type checker where the
  language allows it, and loudly at runtime everywhere else.

## Contributing

New language package: mirror the catalog table, keep the same helper names where the
language allows, zero dependencies, tests with the standard-library test runner.

## License

[Apache License 2.0](LICENSE)
