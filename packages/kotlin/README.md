# gof-patterns (Kotlin/JVM)

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as small, typed
helpers. You write the domain logic; the pattern plumbing is already done.

Zero dependencies. Kotlin 2.4, JVM 17+.

```kotlin
import io.github.andrewtellez.gof.StateMachine

val order = StateMachine(
    initial = "draft",
    transitions = mapOf(
        "draft" to mapOf("pay" to "paid"),
        "paid" to mapOf("ship" to "sent"),
        "sent" to emptyMap(),
    ),
)
order.send("pay")  // "paid"
order.send("pay")  // IllegalStateException: "pay" is not allowed in "sent"
```

## When would I use this?

[**How to use it, and when**](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md)
walks through ten situations from real code — a webhook with several payload shapes, an order
that must not skip steps, a flaky provider that needs retries — and says which helper each
one calls for.

## The catalog

**Ten of the 22 patterns are already in the language.** This package does not wrap them —
the table says what to write instead. That is the most Kotlin has taken off the list of any
package here; Python drops eight, TypeScript five.

### Creational

| Pattern | Use |
| --- | --- |
| Factory Method | `Registry<K, F>()` — `register(key, factory)`, then `registry[key](args)` |
| Abstract Factory | `Registry` — one registry per family |
| Singleton | `object Config { ... }` — the language's own construct, initialised once and thread-safe |
| Prototype | `data class` + `copy()` |
| Builder | Default and named arguments. `Pizza(size = "L", cheese = true)` needs no builder. |

### Structural

| Pattern | Use |
| --- | --- |
| Decorator | `decorate(fn, *wrappers)` — layers on a function value, first wrapper outermost |
| Composite | `Composite(value, children)` — `add`, `walk()` as a lazy `Sequence`, `sum()` |
| Flyweight | `Flyweight(factory)` — one instance per key, `ConcurrentHashMap`-backed |
| Proxy | `by lazy { }` — built on first access, thread-safe by default |
| Adapter | Interface delegation: `class MyLogger(private val w: Winston) : Logger by ...` |
| Facade | An object that delegates. Write it. |
| Bridge | Pass the implementation into the constructor. Write it. |

### Behavioral

| Pattern | Use |
| --- | --- |
| Chain of Responsibility | `chain(handlers, fallback)` — handlers take `(request, next)` |
| Command | `CommandBus()` + `Command(execute, undo)` — `run`, `undo`, `redo` |
| Observer | `Subject<T>()` — `subscribe` returns the unsubscribe lambda |
| Mediator | `Mediator()` with `Mediator.Channel<T>("name")` — typed channels |
| Memento | `History(initial, limit, snapshot)` — undo/redo |
| State | `StateMachine(initial, transitions)` |
| Strategy | `Registry` — swap the registered implementation |
| Visitor | `sealed interface` + `when` — the compiler checks you handled every case |
| Template Method | Default lambda arguments: `fun report(parse: (String) -> T = ::parseCsv)` |
| Iterator | `Sequence`, `iterator { }` and `for` |

## What Kotlin does better than the other packages

**Typed channels on the mediator.** The Python version keys channels by string with an `Any`
payload. Kotlin gets a real token:

```kotlin
val invoicePaid = Mediator.Channel<Invoice>("invoice.paid")

hub.on(invoicePaid) { invoice -> mailer.send(invoice.id) }   // invoice is an Invoice
hub.emit(invoicePaid, invoice)                                // wrong payload will not compile
```

**A lazy composite walk.** `walk()` returns a `Sequence`, so `first { }` stops as soon as it
finds something instead of traversing the whole tree.

**States that can be an enum or a sealed interface.** `StateMachine<S, E>` is generic over
both, so `when (order.state)` stays exhaustive without an `else` branch.

## What it does not have

The `StateMachine` takes a static transition table — `Map<S, Map<E, S>>`. The TypeScript and
Python versions also accept a function as the target, computed from a payload. In Kotlin that
would mean either three type parameters or an `Any?` payload, and neither is worth it: work
out the event yourself and `send` it.

## Development

```bash
./gradlew test    # kotlin.test, no framework
./gradlew build
```

The Gradle wrapper is committed, so nothing needs installing beyond a JDK 17 or newer.

## License

MIT
