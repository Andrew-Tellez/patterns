# Stdlib Equivalents

TypeScript and Python ship a helper for all 22 patterns. For several of them the standard
library already does the job, and often does it better — this page is the list, so you can
skip the helper when the language got there first.

Kotlin is different: it keeps 10 of the 22 as language features with no helper at all,
because `object` and `sealed interface` + `when` are shorter than a helper *and* checked by
the compiler.

## Python

The helper exists in every row; prefer the import when the condition in the last column holds.

| Pattern | Prefer this | When |
| --- | --- | --- |
| Singleton | `functools.cache` | You own the zero-argument function. `singleton()` is for a factory handed to you at runtime. |
| Prototype | `copy.deepcopy` | Always, unless you are already importing the package. `clone` is a one-line alias. |
| Builder | Keyword arguments, `dataclasses.replace` | The call site knows every field. `Builder` is for construction spread across `if` branches. |
| Flyweight | `functools.lru_cache` | You own the factory and the default key works. `Flyweight` is for a runtime factory or a custom key. |
| Visitor | `functools.singledispatch` | Your nodes are classes. `visitor()` dispatches on a *field*, which is what a decoded JSON payload gives you. |
| Iterator | A generator function | You are writing the source. `iterate()` is for a cursor someone else wrote. |
| Facade | An object that delegates | Two or three subsystems, all cheap. `facade()` pays off when they are expensive and rarely all needed. |
| Bridge | Constructor injection | The implementation is chosen once at startup. `bridge()` is for swapping it while callers hold the reference. |

```python
import functools

@functools.cache
def connection():          # Singleton
    return connect(URL)

connection() is connection()   # True
connection.cache_clear()       # for tests
```

## TypeScript

| Pattern | Use this |
| --- | --- |
| Prototype | `structuredClone`. The package re-exports it as `clone` so the catalog is complete — it is an alias, nothing more. It does not copy functions or class prototypes. |
| Iterator | Generator functions and `for...of`. |
| Facade | An object that delegates. Write it. |
| Bridge | Pass the implementation in. Write it. |

TypeScript keeps helpers Python does not need — `singleton`, `builder`, `flyweight`,
`visitor` — because it has no `functools`, no keyword arguments with defaults, and no
single-dispatch. Same catalog, different amount of code, on purpose.

## The rule for new languages

Go looking in the standard library before writing a helper — not to skip it, but to find out
what the helper has to add, and to write that in one sentence in the docstring. If the
language's own construct is shorter *and* safer, as Kotlin's `object` is, the row in this
table is the whole answer.
