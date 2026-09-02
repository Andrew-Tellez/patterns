# patterns

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as small typed
helpers, one package per language, same catalog everywhere.

```bash
npm i @andrew-tellez/patterns   # TypeScript / JavaScript
pip install gof-patterns        # Python
```

The package READMEs are the reference: what each helper is called and how to call it. This
wiki is the part that does not fit in a README — **when** to reach for a pattern, and when
not to.

## Pages

- **[How to use it, and when](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md)**
  — ten situations from real code, with the snippets run as tests.
- **[Choosing a Pattern](Choosing-a-Pattern)** — start from the symptom in your code, not
  from the pattern name.
- **[Stdlib Equivalents](Stdlib-Equivalents)** — the patterns this project refuses to wrap,
  and what to import instead.
- **[Porting to a New Language](Porting-to-a-New-Language)** — how a new package gets built.

## The one idea

Textbook pattern catalogues give you a class diagram to copy by hand. Copying it is the
boring, error-prone half: the listener set, the undo stack, the transition table, the cache
keyed just so. That half is identical in every project, so it lives here.

The interesting half — what a transition *means*, when a handler should answer — stays in
your code, passed in as a function.

Which is also why some entries in the catalog ship no code at all. A helper that saves you
nothing is a dependency that costs you something. See
[Stdlib Equivalents](Stdlib-Equivalents).
