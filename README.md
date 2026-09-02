# patterns

[![ci](https://github.com/Andrew-Tellez/patterns/actions/workflows/ci.yml/badge.svg)](https://github.com/Andrew-Tellez/patterns/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/gof-patterns?label=npm)](https://www.npmjs.com/package/gof-patterns)
[![PyPI](https://img.shields.io/pypi/v/gof-patterns?label=pypi)](https://pypi.org/project/gof-patterns/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Design patterns you can drop into real code — the
[Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) packaged as small
typed helpers instead of textbook class diagrams to copy by hand.

One package per language, each idiomatic to that language, same catalog and same names.

| Language | Package | Status |
| --- | --- | --- |
| TypeScript / JavaScript | [`gof-patterns`](packages/ts) — `npm i gof-patterns` | ✅ |
| Python | [`gof-patterns`](packages/py) — `pip install gof-patterns` | ✅ |
| Kotlin / Java | `packages/kotlin` | planned |
| C# | `packages/csharp` | planned |

## Principles

- **A helper must earn its place.** Where the language or its standard library already has
  the pattern, the README points at it instead of wrapping it: 5 patterns have no helper in
  TypeScript, 8 in Python (`functools.cache`, `copy.deepcopy`, `functools.singledispatch`…).
- **No dependencies**, in any language package.
- **The pattern's plumbing, not your domain.** You pass in the behaviour; the helper handles
  the bookkeeping (history stacks, listener sets, transition tables, caches).
- **Typed.** A state machine with no `ship` transition fails at the type checker where the
  language allows it, and loudly at runtime everywhere else.

## Documentation

- **[How to use it, and when](USE-CASES.md)** — ten situations from real code, the helper each
  one calls for, and when to reach for nothing at all. Every snippet runs as a test.
- Package READMEs — the catalog table and every helper: [TypeScript](packages/ts/README.md) ·
  [Python](packages/py/README.md)
- [Wiki](../../wiki) — when to reach for a pattern, and when not to. Written in
  [`docs/wiki/`](docs/wiki) so it goes through review, then synced by CI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: a helper must earn its place, and
a new language package starts by looking for the patterns its standard library already has.

Adding a language is the most useful contribution right now — Kotlin/JVM and C# are next.

## License

[MIT](LICENSE)
