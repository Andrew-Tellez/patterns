# patterns

[![ci](https://github.com/Andrew-Tellez/patterns/actions/workflows/ci.yml/badge.svg)](https://github.com/Andrew-Tellez/patterns/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/gof-patterns?label=npm)](https://www.npmjs.com/package/gof-patterns)
[![PyPI](https://img.shields.io/pypi/v/gof-patterns?label=pypi)](https://pypi.org/project/gof-patterns/)
[![coverage](https://img.shields.io/badge/coverage-%E2%89%A599%25%20lines-brightgreen)](#coverage)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Design patterns you can drop into real code — the
[Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) packaged as small
typed helpers instead of textbook class diagrams to copy by hand.

All 22 patterns of the catalog, one package per language, each idiomatic to that language.

| Language | Package | Status |
| --- | --- | --- |
| TypeScript / JavaScript | [`gof-patterns`](packages/ts) — `npm i gof-patterns` | ✅ |
| Python | [`gof-patterns`](packages/py) — `pip install gof-patterns` | ✅ |
| Kotlin / JVM | [`io.github.andrew-tellez:gof-patterns`](packages/kotlin) | ✅ code, not published yet — 12 helpers, 10 patterns are language features |
| C# | `packages/csharp` | planned |

## Principles

- **The whole catalog, and honest about it.** TypeScript and Python ship a helper for all 22
  patterns. Several of them wrap something the standard library already does — the README says
  which, and when you should prefer the stdlib (`functools.cache`, `structuredClone`,
  `functools.singledispatch`). A complete catalog you can teach beats a tidy one with holes,
  but you should still know when the language got there first.
- **No helper is a bare wrapper.** Where the stdlib covers the common case, the helper adds
  the part it does not: `facade` builds subsystems lazily, `Flyweight` takes a custom key,
  `visitor` dispatches on a field so it works on JSON, `bridge` keeps a stable reference
  across a swap.
- **No dependencies**, in any language package.
- **The pattern's plumbing, not your domain.** You pass in the behaviour; the helper handles
  the bookkeeping (history stacks, listener sets, transition tables, caches).
- **Typed.** A state machine with no `ship` transition fails at the type checker where the
  language allows it, and loudly at runtime everywhere else.

## Coverage

Every package is at or near full coverage, and CI fails the build if it slips. The tools are
the ones already in the toolchain — Node's built-in coverage, `coverage.py`, JaCoCo — so this
costs no runtime dependency and no third-party service.

| Package | Tests | Lines | Branches | Gate enforced in CI |
| --- | --- | --- | --- | --- |
| TypeScript | 40 | 100% (99.6% as Node 22 counts it) | 98.2% | lines 99%, branches 95%, functions 90% |
| Python | 45 | 100% | — | lines 100% (`--fail-under=100`) |
| Kotlin | 23 | 100% | 97.7% | lines 99%, branches 95% |

```bash
cd packages/ts     && npm run coverage
cd packages/py     && python3 -m coverage run --source=gof_patterns -m unittest discover -s tests -t . && python3 -m coverage report -m
cd packages/kotlin && ./gradlew jacocoTestCoverageVerification
```

The badge tracks the enforced gate rather than a live measurement: coverage cannot fall below
it without the build going red, so there is no third-party service in the loop. Add Codecov if
you want per-commit numbers and a diff view on pull requests.

The TypeScript gate is 99% rather than 100% because Node 22 and Node 24 instrument the same
code differently — 99.64% against 100% — and a threshold has to hold on every runtime the
package supports.

## Documentation

- **[How to use it, and when](USE-CASES.md)** — thirteen situations from real code, the helper each
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
