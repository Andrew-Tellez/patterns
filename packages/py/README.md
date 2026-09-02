# gof-patterns

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as small, typed
helpers. You write the domain logic; the pattern plumbing is already done.

Zero dependencies. Python 3.10+.

```bash
pip install gof-patterns
```

```python
from gof_patterns import StateMachine

order = StateMachine("draft", {
    "draft": {"pay": "paid"},
    "paid": {"ship": "sent"},
    "sent": {},
})
order.send("pay")   # "paid"
order.send("pay")   # ValueError: 'pay' is not allowed in 'sent'
```

## When would I use this?

[**How to use it, and when**](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md) walks through thirteen situations from real
code — a webhook with several payload shapes, an order that must not skip steps, a flaky
provider that needs retries — and says which helper each one calls for.

## The catalog

**All 22 patterns, all with a helper.** Several of them wrap something already in the standard
library — those are here so the catalog is complete and so the API matches the other language
packages. The Notes column says when to prefer the stdlib, and you usually should.

### Creational

| Pattern | Helper | Notes |
| --- | --- | --- |
| Singleton | `singleton(factory)` | `.reset()` for tests. Prefer `functools.cache` on a zero-argument function you own. |
| Factory Method | `Registry()` | `register(key, creator)` / `create(key, *args)`, also a decorator. |
| Abstract Factory | `Registry()` | One registry per family. |
| Builder | `Builder(cls?, **defaults)` | Fluent setters, `.set(**kw)` for awkward keys. Prefer keyword arguments; this earns its place when construction is spread across branches. |
| Prototype | `clone(value)` | Alias for `copy.deepcopy`. Use `copy.copy` for shallow, `dataclasses.replace` to copy with changes. |

### Structural

| Pattern | Helper | Notes |
| --- | --- | --- |
| Adapter | `adapt(source, **methods)` | Returns a `SimpleNamespace`. |
| Bridge | `bridge(build, impl)` | Stable reference; `swap(impl)` redirects every caller that already holds it. |
| Composite | `Composite(value, children?)` | `add`, `walk()`, `sum()`, `len()` |
| Decorator | `decorate(fn, *wrappers)` | `functools.wraps` applied for you. First wrapper is outermost. |
| Facade | `facade(subsystems, build)` | Subsystems are built lazily — only the ones the called operation touches. |
| Flyweight | `Flyweight(factory, key?)` | Prefer `functools.lru_cache` for a factory you own; use this for a custom key or a runtime factory. |
| Proxy | `lazy(loader)` | Built on first attribute access. `functools.cached_property` when it hangs off an object you already have. |

### Behavioral

| Pattern | Helper | Notes |
| --- | --- | --- |
| Chain of Responsibility | `chain(handlers, fallback=None)` | Handlers take `(request, next_)`. |
| Command | `CommandBus()` + `Do(do, undo=...)` | `run`, `undo`, `redo` |
| Iterator | `iterate(cursor)` | Wraps a `has_next`/`next` cursor (or camelCase, for SDKs). Writing your own source? Use a generator. |
| Mediator | `Mediator()` | `on` / `emit` hub. |
| Memento | `History(initial, limit, snapshot)` | Undo/redo over snapshots. |
| Observer | `Subject[T]()` | `subscribe` returns the unsubscribe. |
| State | `StateMachine(initial, states)` | |
| Strategy | `Registry()` | Swap the registered implementation. |
| Template Method | `template(defaults, skeleton)` | Unknown step names raise. |
| Visitor | `visitor(visitors, fallback=None, kind="type")` | Dispatches on a **field**, for dicts from JSON. Prefer `functools.singledispatch` when your nodes are classes. |

The original book describes 23 patterns; the Refactoring Guru catalog omits Interpreter, and
so does this package — a general-purpose interpreter helper is a parser generator, not a
pattern helper.

## Examples

**Registry as a decorator** — Factory Method with no `if/elif` ladder:

```python
shapes: Registry[Shape] = Registry()

@shapes.register("circle")
def _(r: float) -> Shape:
    return Circle(r)

shapes.create("circle", 2)
```

**Chain of Responsibility** — first handler that answers wins:

```python
route = chain(
    [lambda t, next_: "bot" if t.level == 1 else next_(),
     lambda t, next_: "human" if t.paid else next_()],
    fallback=lambda t: "queue",
)
```

**Memento** — pass `snapshot` when the state is mutated in place:

```python
import copy
h = History({"text": ""}, limit=50, snapshot=copy.deepcopy)
h.save({"text": "hi"})
h.undo()  # {"text": ""}
```

## Development

```bash
python3 -m unittest discover -s tests -t .   # stdlib, no framework
```

## License

MIT
