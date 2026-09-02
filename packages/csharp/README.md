# gof-patterns (C# / .NET)

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as small, typed
helpers. You write the domain logic; the pattern plumbing is already done.

No dependencies. `net8.0`, so it runs on .NET 8, 9 and 10.

```bash
dotnet add package gof-patterns
```

```csharp
using GofPatterns;

var order = new StateMachine<string, string>("draft", new()
{
    ["draft"] = new() { ["pay"] = "paid" },
    ["paid"] = new() { ["ship"] = "sent" },
    ["sent"] = [],
});

order.Send("pay");  // "paid"
order.Send("pay");  // InvalidOperationException: "pay" is not allowed in "sent"
```

The NuGet id is `gof-patterns` — the same name as on npm, PyPI and Maven Central, because
`GofPatterns` was already taken. The namespace is `GofPatterns`.

## When would I use this?

[**How to use it, and when**](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md)
walks through thirteen situations from real code and says which helper each one calls for.

## The catalog

All 22 patterns. Where .NET already has something better, the Notes column says so — use it
and skip the helper.

### Creational

| Pattern | Use | Notes |
| --- | --- | --- |
| Singleton | `new Singleton<T>(factory)` | `Lazy<T>` does this and is thread-safe; this adds `Reset()` for tests. |
| Factory Method | `new Registry<TKey, TFactory>()` | `Register(key, factory)`, then `registry[key](args)`. `TFactory` is any delegate, so the call stays typed. |
| Abstract Factory | `Registry` | One registry per family. |
| Builder | `new Builder<T>(draft)` | `WithIf(condition, change)` is the point — construction spread across branches. Object initializers cover the rest; prefer them. |
| Prototype | `record` + `with` | Idiomatic shallow copy. `Prototype.Clone` is a deep copy via JSON round-trip, with the limits that implies. |

### Structural

| Pattern | Use | Notes |
| --- | --- | --- |
| Adapter | `Adapter.Adapt(source, build)` | Thin on purpose — a small class implementing your interface is usually better. |
| Bridge | `new Bridge<TImpl, TApi>(build, impl)` | Read `.Api` per call; `Swap` reaches callers that already hold the bridge. |
| Composite | `new Composite<T>(value, children)` | `Walk()` is lazy, so LINQ and an early `First` stop the traversal. |
| Decorator | `Decorator.Decorate(fn, wrappers)` | First wrapper is outermost. |
| Facade | A class with `Lazy<T>` fields | No helper: one that takes a parts object has to construct it to pass it in, which defeats the purpose. The header comment in `Structural.cs` shows the shape. |
| Flyweight | `new Flyweight<TKey, TValue>(factory)` | `ConcurrentDictionary.GetOrAdd` underneath, plus `Count` and `Clear`. |
| Proxy | `Lazy<T>` | Built on first read, thread-safe. Nothing to add. |

### Behavioral

| Pattern | Use | Notes |
| --- | --- | --- |
| Chain of Responsibility | `Chain.Of(handlers, fallback)` | Handlers take `(request, next)`. |
| Command | `new CommandBus()` + `new Command<T>(execute, undo)` | `Run`, `Undo`, `Redo`. |
| Iterator | `Iterator.Iterate(hasNext, next)` | Wraps a driver or SDK cursor into `IEnumerable<T>`. Writing the source yourself? `yield return`. |
| Mediator | `new Mediator()` + `Mediator.Channel<T>` | Channels carry their payload type. |
| Memento | `new History<T>(initial, limit, snapshot)` | Undo/redo over snapshots. |
| Observer | `new Subject<T>()` | `Subscribe` returns `IDisposable`, so `using` scopes it. `event` is fine too. |
| State | `new StateMachine<TState, TEvent>(initial, transitions)` | Works with an `enum`, so a `switch` stays exhaustive. |
| Strategy | `Registry` | Swap the registered implementation. |
| Template Method | `Template.Of(defaults, skeleton, overrides)` | Optional parameters with delegate defaults are more idiomatic; prefer them. |
| Visitor | `Visitor.On(tag, visitors, fallback)` | Dispatches on a value you extract, for a `JsonNode` or a dictionary. Pattern matching on a type hierarchy is better for classes — and the compiler checks it. |

The original book describes 23 patterns; the Refactoring Guru catalog omits Interpreter, and so
does this package.

## Development

```bash
dotnet test    # MSTest
dotnet build
dotnet pack -c Release
```

The library targets `net8.0`; the test project rolls forward, so it runs on whatever runtime
is installed.

## License

MIT
