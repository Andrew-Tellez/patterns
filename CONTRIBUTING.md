# Contributing

Thanks for looking. This project has one strong opinion, and it shapes every review:

> **Every helper has to add something.** The catalog is complete — TypeScript and Python cover
> all 22 patterns — but a helper that only renames a standard-library feature is not finished.

Python's `singleton` exists next to `functools.cache` because it takes a factory in hand and
matches the name the other packages use; its docstring tells you to prefer `functools.cache`
when you own the function. `visitor` exists next to `functools.singledispatch` because it
dispatches on a *field*, which is what JSON gives you. That is the bar: name the thing the
stdlib does not do, in the docstring, in one sentence.

Kotlin is the exception and stays at 12 helpers: `object`, `by lazy` and `sealed interface`
are shorter than a helper *and* compiler-checked, so wrapping them would make the package
worse.

## What makes a good pattern helper here

1. **It removes bookkeeping, not decisions.** We own the history stack, the listener set,
   the transition table, the cache. You own the domain logic you pass in.
2. **It is smaller than what it replaces.** If the helper is longer than hand-writing the
   pattern, the answer is a README row, not code.
3. **Zero dependencies.** Every package, every language. No exceptions.
4. **Typed.** Wrong usage should fail at the type checker where the language allows it, and
   raise a clear error where it does not.
5. **One runnable check.** Every behaviour gets a test with the language's *standard library*
   test runner. No test frameworks.

## Setup

Each language lives in its own package under `packages/` and is developed on its own.

**TypeScript** (`packages/ts`) — needs Node 22.18+ to run the tests, since they use Node's
built-in TypeScript stripping. The published package itself supports Node 18+.

```bash
cd packages/ts
npm ci
npx tsc --noEmit     # typecheck
npm test             # node --test
npm run build        # tsc -> dist/
```

**Python** (`packages/py`) — needs 3.10+. No virtualenv required; there are no dependencies.

```bash
cd packages/py
python3 -m unittest discover -s tests -t . -v
```

## Commits

The repo uses [Conventional Commits](https://www.conventionalcommits.org), enforced by
[cocogitto](https://docs.cocogitto.io) (`cog.toml`). The scope is the package:

```
feat(ts): add a retry wrapper example to decorate
fix(py): History.limit dropped the wrong end of the stack
docs(wiki): explain when a state machine beats a boolean
```

Run `cog check` before pushing if you have cocogitto installed. The version numbers and
`CHANGELOG.md` are generated from these messages, so a sloppy subject line becomes a sloppy
release note.

## Pull requests

CI must be green: `ts` on Node 22 and 24, `py` on Python 3.10 through 3.13. Both jobs also
build the package, which is what catches a broken `exports` map or `pyproject.toml` before a
release does.

For a change to a helper, the PR should say:

- which catalog entry it belongs to,
- what bookkeeping it removes,
- why the stdlib does not already cover it.

## Adding a new language

This is the most useful contribution right now. Kotlin/JVM and C# are the next two on the
list. The rules:

- **Same catalog, idiomatic names.** `stateMachine` in TypeScript, `StateMachine` in Python,
  `StateMachine` in Kotlin. Follow the language, not the other packages.
- **Check the standard library first.** Not to skip the helper — to know what it has to add,
  and to write that sentence in the docstring. Where the language's own construct is shorter
  *and* safer, as with Kotlin's `object`, the table entry is the answer.
- **Mirror the catalog table** in the package README: all 22 rows, the helper for each, and a
  Notes column saying when the language's own construct is the better choice.
- **Standard-library test runner.** `node --test`, `unittest`, `kotlin.test`, `dotnet test`.
- **Zero dependencies.**
- Add a job to `.github/workflows/ci.yml`, a `[packages.<name>]` entry to `cog.toml`, and a
  publish job to `.github/workflows/release.yml`.

The [Porting to a New Language](../../wiki/Porting-to-a-New-Language) wiki page walks through
the decisions in more detail.

## Releasing

Maintainers only, and deliberately boring:

1. Bump the version **in the package** — `packages/ts/package.json` or
   `packages/py/pyproject.toml`.
2. `cog bump --auto` — this tags `ts-vX.Y.Z` and/or `py-vX.Y.Z` and writes `CHANGELOG.md`.
3. Push the tag. `release.yml` re-runs the tests, **verifies the tag matches the version
   declared in the package** (a mismatch fails the job instead of publishing the wrong
   thing), then publishes:
   - npm via trusted publishing, with `--provenance`, so the published tarball is attested
     to this repo and workflow;
   - PyPI via trusted publishing.

Neither registry uses a long-lived token. Both authenticate with a short-lived OIDC token
minted per run, which is also why the `release` environment name has to match what is
configured on npm and PyPI.

One tag publishes one package. A `ts-v*` tag never touches PyPI.

**Repository settings this depends on** (one-time, by a maintainer):

- a `release` GitHub environment,
- an npm trusted publisher for `gof-patterns` pointing at this repo, workflow
  `release.yml`, environment `release`,
- a PyPI trusted publisher for `gof-patterns` pointing at this repo, workflow
  `release.yml`, environment `release`,
- the wiki initialised with one page, so `wiki.yml` has somewhere to push.

## License

By contributing you agree your work is licensed under the [MIT License](LICENSE), the same
as the rest of the repo. No CLA.
