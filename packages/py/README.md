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

[**How to use it, and when**](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md) walks through ten situations from real
code — a webhook with several payload shapes, an order that must not skip steps, a flaky
provider that needs retries — and says which helper each one calls for.

## The catalog

**Six of the 22 patterns are already in the standard library.** This package does not wrap
them — the table tells you what to import instead.

### Creational

| Pattern | Use |
| --- | --- |
| Factory Method | `Registry()` — `register(key, creator)` / `create(key, *args)`, also a decorator |
| Abstract Factory | `Registry()` — one registry per family |
| Singleton | `functools.cache` on a zero-argument factory; `cache_clear()` for tests |
| Prototype | `copy.deepcopy` |
| Builder | keyword arguments with defaults, `dataclasses.replace` |

### Structural

| Pattern | Use |
| --- | --- |
| Adapter | `adapt(source, **methods)` |
| Decorator | `decorate(fn, *wrappers)` — layers on an existing object, read left to right |
| Composite | `Composite(value, children=None)` — `add`, `walk()`, `sum()`, `len()` |
| Proxy | `lazy(loader)` — real object built on first attribute access |
| Flyweight | `functools.lru_cache` — shared instances per key, plus `cache_info()` |
| Facade | an object that delegates. Just write it. |
| Bridge | pass the implementation in. Just write it. |

### Behavioral

| Pattern | Use |
| --- | --- |
| Chain of Responsibility | `chain(handlers, fallback=None)` — handlers take `(request, next)` |
| Command | `CommandBus()` + `Do(do, undo=...)` — `run`, `undo`, `redo` |
| Observer | `Subject[T]()` — `subscribe` returns the unsubscribe |
| Mediator | `Mediator()` — `on` / `emit` hub |
| Memento | `History(initial, limit=inf, snapshot=...)` — undo/redo |
| State | `StateMachine(initial, states)` |
| Strategy | `Registry()` — swap the registered implementation |
| Template Method | `template(defaults, skeleton)` — override single steps, no subclass |
| Visitor | `functools.singledispatch` — `area.register(Circle, ...)` |
| Iterator | generators and `for` |

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
