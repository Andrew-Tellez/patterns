# Contributing

Thanks for looking. This project has one strong opinion, and it shapes every review:

> **A helper must earn its place.** If the language or its standard library already gives you
> the pattern, we document that instead of wrapping it.

That is why Python has no `singleton` (it has `functools.cache`) and TypeScript has no
`iterator` (it has generators). A PR that adds a wrapper around a stdlib feature will be
turned down, kindly, with a pointer to the table entry it belongs in.

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
- **Start by deleting.** Before writing a helper, check the standard library. Python dropped
  eight of the 22 that way, and the README is better for it.
- **Mirror the catalog table** in the package README, including the rows with no helper and
  what to write instead.
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
   - npm with `--provenance`, so the published tarball is attested to this repo and workflow;
   - PyPI via trusted publishing, so there is no long-lived API token to leak.

One tag publishes one package. A `ts-v*` tag never touches PyPI.

**Repository settings this depends on** (one-time, by a maintainer):

- a `release` GitHub environment,
- `NPM_TOKEN` as a secret in that environment (an automation token with publish rights),
- a PyPI trusted publisher for `gof-patterns` pointing at this repo, workflow
  `release.yml`, environment `release`,
- the wiki initialised with one page, so `wiki.yml` has somewhere to push.

## License

By contributing you agree your work is licensed under the
[Apache License 2.0](LICENSE), the same as the rest of the repo. No CLA.
