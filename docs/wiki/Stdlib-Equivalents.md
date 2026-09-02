# Stdlib Equivalents

This project refuses to wrap what a language already gives you. The wrapper would be more
code to read than the pattern it hides, plus a dependency, plus a name your team has to look
up. So those catalog entries ship documentation instead of code.

Five of the 22 have no helper in TypeScript. Eight have none in Python.

## Python

| Pattern | Import this |
| --- | --- |
| Singleton | `functools.cache` on a zero-argument factory. `db()` returns the same object every time; `db.cache_clear()` resets it for tests. |
| Prototype | `copy.deepcopy` |
| Builder | Keyword arguments with defaults, and `dataclasses.replace` for a modified copy. |
| Flyweight | `functools.lru_cache` — shared instances per argument tuple, with `cache_info()` and `cache_clear()` included. |
| Visitor | `functools.singledispatch` — `@area.register` per node type. Real type dispatch, not a string tag. |
| Iterator | Generators and `for`. |
| Facade | An object that delegates. Write it. |
| Bridge | Pass the implementation into the constructor. Write it. |

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

Before writing a helper, go looking for it in the standard library. Every one you find is a
row in this table, and the package gets better. Python lost eight helpers that way and reads
more like Python for it.
