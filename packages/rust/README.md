# gof-patterns (Rust)

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as small, typed
helpers. You write the domain logic; the pattern plumbing is already done.

Nothing outside `std`. Rust 1.80+, `#![forbid(unsafe_code)]`, `missing_docs` denied.

```bash
cargo add gof-patterns
```

```rust
use gof_patterns::StateMachine;
use std::collections::HashMap;

let mut order = StateMachine::new("draft", HashMap::from([
    ("draft", HashMap::from([("pay", "paid")])),
    ("paid",  HashMap::from([("ship", "sent")])),
    ("sent",  HashMap::new()),
]));

order.send("pay")?;   // "paid"
order.send("pay")?;   // Err: pay is not allowed in sent
```

## When would I use this?

[**How to use it, and when**](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md)
walks through thirteen situations from real code and says which helper each one calls for.

## Rust changed the patterns, it did not receive them

This is the package where ownership rewrote the API, and the differences are the interesting
part:

**Sharing is `Arc`, not a reference.** `Singleton::get` and `Flyweight::get` hand back
`Arc<T>`. A value living behind a lock cannot be lent out as `&T`, so the sharing is explicit
in the type. Every other package here hides that.

**Chain of Responsibility has no `next` callback.** A handler returns `Option`: `Some`
answers, `None` passes the turn. A recursive `next` closure fights the borrow checker for
nothing, and `None` says "not mine" more plainly than calling a function whose only job is to
move on. This is the one helper whose *shape* differs across the six languages.

**Unsubscribing is a guard, not a call.** `Subject::subscribe` returns a `Subscription` that
removes the listener when it drops. The subscription's lifetime *is* the subscription — which
is the Rust way of saying it, and it means you cannot leak a listener by forgetting to call
something.

**Memento needs `Clone`, and the bound says so.** No language can snapshot what it cannot
copy. Rust is the one that makes you admit it in the signature instead of finding out at
runtime that your history holds the same mutated object five times.

**Listeners are `'static`.** A callback stored in a collection outlives the statement that
created it, so it cannot borrow a local. Share what it touches — usually `Rc<RefCell<_>>` —
which makes the shared mutation visible instead of hiding it inside a closure.

## The catalog

All 22 patterns. Where Rust already does the job, the Notes column says so.

### Creational

| Pattern | Use | Notes |
| --- | --- | --- |
| Singleton | `Singleton::new(factory)` | `std::sync::LazyLock` is idiomatic; prefer it unless you need `reset()`. Returns `Arc<T>`. |
| Factory Method | `Registry::new()` | `register`, then `get` → `Result<&F, RegistryError>` naming the key. |
| Abstract Factory | `Registry` | One registry per family. |
| Builder | `Builder::new(draft)` | Takes `self` by value, so the chain moves. `with_if` is what this adds over a hand-written builder. |
| Prototype | `#[derive(Clone)]` | `Clone` *is* the pattern. No helper could be shorter. |

### Structural

| Pattern | Use | Notes |
| --- | --- | --- |
| Adapter | A newtype implementing your trait | Four lines, and the compiler checks it. |
| Bridge | `Bridge::new(build, impl)` | Call `.api()` per use; `swap` reaches callers that already hold the bridge. |
| Composite | `Composite::new(value)` | `walk()` is a lazy iterator over an explicit stack, so `find` stops early. |
| Decorator | `decorate(f, wrappers)` | `Layer` and `Wrapper` name the boxed closure types. First wrapper is outermost. |
| Facade | A struct of `OnceLock` fields | Each subsystem built on first use. |
| Flyweight | `Flyweight::new(factory)` | One `Arc<V>` per key, mutex guarded, factory runs once per key. |
| Proxy | `std::sync::LazyLock` | Lazy, once, `Sync`. Nothing to add. |

### Behavioral

| Pattern | Use | Notes |
| --- | --- | --- |
| Chain of Responsibility | `chain(handlers, fallback)` | Handlers return `Option`; `ErrNoHandler` when nothing answers. |
| Command | `CommandBus` + `Command::new` | `Command::once` for one that cannot be undone. |
| Iterator | `std::iter::from_fn` | Wraps a cursor. The `Iterator` trait covers the rest. |
| Mediator | `Mediator::channel::<T>(name)` | A channel is its name *and* its payload type, so the same name with a different type is a different channel. |
| Memento | `History::new` / `with_limit` | `T: Clone`, for the reason above. |
| Observer | `Subject::new()` | `subscribe` returns a `Subscription` guard. |
| State | `StateMachine::new(initial, table)` | `send` → `Result`; `changes()` is a free audit trail. |
| Strategy | `Registry` | Swap the registered implementation. |
| Template Method | A struct of closure fields with `Default` | The constructor filling the defaults *is* the pattern. |
| Visitor | `visitor(tag, visitors, fallback)` | `match` on an enum is better when your nodes are an enum — the compiler checks exhaustiveness. This is for a tag field. |

The original book describes 23 patterns; the Refactoring Guru catalog omits Interpreter, and so
does this crate.

## Development

```bash
cargo test                 # 22 integration tests plus 10 doctests
cargo clippy --all-targets # clippy::all is denied, including in the tests
cargo fmt --check
```

`unsafe_code` is **forbidden**, not merely denied. The first draft of `Subject` used a
`transmute` to extend a listener's lifetime; the lint refused it, which was correct — that was
a soundness hole. The safe version stores listeners as `Rc<dyn Fn(&T)>` and snapshots them
before calling, so a listener can drop its own subscription mid-emit.

## License

MIT
