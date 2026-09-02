# patterns

Design patterns you can drop into real code — the
[Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) packaged as small
typed helpers instead of textbook class diagrams to copy by hand.

One package per language, each idiomatic to that language, same catalog and same names.

| Language | Package | Status |
| --- | --- | --- |
| TypeScript / JavaScript | [`@andrew-tellez/patterns`](packages/ts) — `npm i @andrew-tellez/patterns` | ✅ |
| Python | `packages/py` | planned |
| Kotlin / Java | `packages/kotlin` | planned |
| C# | `packages/csharp` | planned |

Start with [packages/ts](packages/ts/README.md) for the full catalog table and examples.

## Principles

- **A helper must earn its place.** Five of the 22 patterns ship no helper — Facade, Bridge
  and Iterator among them — because the wrapper would be longer than the code it hides. The
  README says what to write instead.
- **No dependencies**, in any language package.
- **The pattern's plumbing, not your domain.** You pass in the behaviour; the helper handles
  the bookkeeping (history stacks, listener sets, transition tables, caches).
- **Typed.** If a state machine has no `ship` transition, that is a compile error, not a
  runtime surprise.

## Contributing

New language package: mirror the catalog table, keep the same helper names where the
language allows, zero dependencies, tests with the standard-library test runner.

## License

[Apache License 2.0](LICENSE)
