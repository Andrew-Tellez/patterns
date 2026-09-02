# Porting to a New Language

Kotlin/JVM and C# are the next two. This is the whole procedure.

## 1. Read the standard library first

Not the catalog. The standard library.

Each pattern the language already provides is a helper you do not write — a row in
[Stdlib Equivalents](Stdlib-Equivalents) instead. Some starting points:

- **Kotlin** — `object` declarations *are* Singleton; `by lazy` is Proxy; `sealed class` +
  `when` is Visitor with exhaustiveness checked by the compiler; default and named arguments
  cover Builder; `data class` + `copy()` covers Prototype; `Sequence` covers Iterator. That
  is six or seven gone before you start.
- **C#** — `Lazy<T>` is Proxy and Singleton; `event`/`IObservable<T>` is Observer; records
  with `with` expressions cover Prototype; optional and named arguments cover Builder;
  `IEnumerable<T>` + `yield return` covers Iterator; pattern matching on a type hierarchy
  covers Visitor.

A short helper list is a sign the port went well, not a sign it is unfinished.

## 2. Keep the catalog, follow the language

Same 22 entries, same concepts, **local naming conventions**. `stateMachine` in TypeScript,
`StateMachine` in Python and Kotlin. Do not carry camelCase into Python or snake_case into
Kotlin to make the packages look alike. The README table is what keeps them in step.

Where a language has something better than the shared design, take it. Kotlin's
`StateMachine` should use a sealed class for states so the compiler checks exhaustiveness,
even though TypeScript uses string literals. The pattern is the contract; the encoding is
not.

## 3. Write the tests as the specification

Each behaviour gets a test with the language's **standard library** runner — `kotlin.test`,
`dotnet test`, `node --test`, `unittest`. No test frameworks, no fixtures, no mocks.

Two rules that matter more than coverage:

- **Test the stdlib rows too.** The Python suite asserts that `functools.cache` behaves like
  a Singleton and `functools.singledispatch` behaves like a Visitor. That makes the "use this
  instead" table a tested claim rather than an assertion in prose.
- **Keep parity tests in step.** Both suites cover the same edge cases: unsubscribing during
  an emit, a `save` dropping the redo future, a dynamic state target, an unknown registry key.
  When you find a new edge case, add it everywhere.

## 4. Zero dependencies

Every package, every language. A pattern helper that drags in a dependency has failed at the
only thing it was for.

## 5. Wire it up

Four files, in this order:

1. `packages/<lang>/` — the package, its README with the full catalog table (helpers *and*
   the no-helper rows), and the language's own license copy.
2. `.github/workflows/ci.yml` — a job named for the language, running the tests on the oldest
   and newest supported runtime, plus a package build step. Add it to the `ci-ok` job's
   `needs` list.
3. `cog.toml` — a `[packages.<lang>]` entry, so `cog bump --auto` produces a
   `<lang>-vX.Y.Z` tag.
4. `.github/workflows/release.yml` — a publish job gated on that tag prefix, which verifies
   the tag matches the version declared inside the package before publishing anything.

Then the root `README.md` table moves your language from *planned* to shipped.

## 6. What review will ask

- Which catalog entry is this, and what bookkeeping does it remove?
- Why does the standard library not already cover it?
- Is the helper shorter than writing the pattern by hand? Show both.

If the answer to the last one is no, the contribution is a README row — and that is a real
contribution here, not a consolation prize.
