# gof-patterns (Go)

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as small, typed
helpers. You write the domain logic; the pattern plumbing is already done.

Nothing outside the standard library. Go 1.23+ (the tree and cursor walks are `iter.Seq`).

```bash
go get github.com/Andrew-Tellez/patterns/packages/go
```

```go
import gof "github.com/Andrew-Tellez/patterns/packages/go"

order := gof.NewStateMachine("draft", map[string]map[string]string{
    "draft": {"pay": "paid"},
    "paid":  {"ship": "sent"},
    "sent":  {},
})

order.Send("pay")  // "paid", nil
order.Send("pay")  // error: pay is not allowed in sent
```

There is no registry to publish to: `go get` resolves a version from the repository tag and
the module proxy caches it. Go is the one language here where releasing is a `git tag`.

![Singleton en Go](https://raw.githubusercontent.com/Andrew-Tellez/patterns/main/docs/videos/singleton-readme.gif)

The videos are rendered from code, not screen-recorded. This one is Singleton in
Go: [watch the full version](https://github.com/Andrew-Tellez/patterns/blob/main/docs/videos/singleton-go.mp4).

## When would I use this?

[**How to use it, and when**](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md)
walks through thirteen situations from real code and says which helper each one calls for.

## The catalog

All 22 patterns. Where Go already does the job, the Notes column says so — use the language.

### Creational

| Pattern | Use | Notes |
| --- | --- | --- |
| Singleton | `NewSingleton(factory)` | `sync.OnceValue` is idiomatic and you should prefer it. This adds `Reset()`, which a test needs. |
| Factory Method | `NewRegistry[K, F]()` | `Register`, then `Get` (with an error) or `MustGet`. `F` is your func type, so calls stay typed. |
| Abstract Factory | `NewRegistry` | One registry per family. |
| Builder | `NewBuilder(draft)` | Functional options are the idiomatic Go builder; reach for those first. `WithIf` is what this adds. |
| Prototype | `Clone(value)` | A JSON round-trip, so the type must be serialisable and funcs, channels, unexported fields and cycles are dropped. For a type you own, write a `Clone` method. |

### Structural

| Pattern | Use | Notes |
| --- | --- | --- |
| Adapter | `Adapt(source, build)` | Thin. A small struct implementing your interface, or interface embedding, is usually better. |
| Bridge | `NewBridge(build, impl)` | Read `.API()` per call; `Swap` reaches callers that already hold the bridge. |
| Composite | `NewComposite(value, children...)` | `Walk()` is an `iter.Seq`, so `break` stops the traversal. |
| Decorator | `Decorate(fn, wrappers...)` | First wrapper is outermost. |
| Facade | A struct of `sync.OnceValue` fields | No helper: `OnceValue` is lazy, runs once and is goroutine-safe. `structural.go` shows the shape. |
| Flyweight | `NewFlyweight(factory)` | One value per key, mutex-guarded, factory runs once per key. |
| Proxy | `sync.OnceValue` | Same reason as Facade. |

### Behavioral

| Pattern | Use | Notes |
| --- | --- | --- |
| Chain of Responsibility | `Chain(handlers, fallback)` | Handlers take `(request, next)`. `nil` fallback returns `ErrNoHandler`. |
| Command | `NewCommandBus()` + `Run(bus, cmd)` | `Run` is a func, not a method: a Go method cannot introduce a type parameter. |
| Iterator | `Iterate(hasNext, next)` | Wraps a driver cursor into an `iter.Seq`. Writing the source yourself? A plain `iter.Seq` or a channel. |
| Mediator | `NewMediator()` + `NewChannel[T]` | `On` and `Emit` are funcs, for the same type-parameter reason. Channels carry their payload type. |
| Memento | `NewHistory(initial, options...)` | `WithLimit`, `WithSnapshot`. |
| Observer | `Subject[T]` | `Subscribe` returns the unsubscribe func. A channel and a goroutine is better when consumers are concurrent. |
| State | `NewStateMachine(initial, transitions)` | `Send` returns an error; `MustSend` panics. Works with a named string type or an int enum. |
| Strategy | `NewRegistry` | Swap the registered implementation. |
| Template Method | A struct of func fields | No helper: a constructor that fills defaults *is* the pattern, and it is shorter. `behavioral.go` shows it; `NewHistory` uses the same idea. |
| Visitor | `Visitor(tag, visitors, fallback)` | Dispatches on a tag you extract, for decoded JSON or a database row. When nodes are distinct Go types, a type switch is clearer and the compiler helps. |

The original book describes 23 patterns; the Refactoring Guru catalog omits Interpreter, and so
does this package.

## What Go changes

**Errors, not exceptions.** `Registry.Get`, `StateMachine.Send`, `Chain` and `Visitor` return
an error. Each has a `Must` twin, or a sentinel — `ErrNoHandler` works with `errors.Is` — for
the case where the failure is a programming error rather than an input.

**`Run`, `On` and `Emit` are funcs, not methods.** A Go method cannot declare its own type
parameter, so anything whose type comes from the argument rather than the receiver has to be
a package-level func. That is why it is `gof.Run(bus, cmd)` and not `bus.Run(cmd)`.

**`iter.Seq` everywhere it helps.** `Composite.Walk` and `Iterate` are range-over-func
iterators, so `break` actually stops the work instead of draining a slice you built anyway.

**Concurrency is not optional.** `Singleton`, `Flyweight`, `Bridge` and `Subject` are mutex
guarded, and the suite runs under `-race`. A Go library that is not safe to share is not
finished.

## Development

```bash
go test ./...
go test -race -cover ./...   # what CI runs
go vet ./...
gofmt -l .
```

## Releasing

The module lives in a subdirectory, so the Go module proxy requires the tag to be prefixed
with that path — `packages/go/v0.1.0`, not `go-v0.1.0` like the other packages. That is a Go
rule, not a choice.

## License

MIT
