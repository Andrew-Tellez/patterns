# gof-patterns

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as tiny, typed
helpers. You write the domain logic; the pattern plumbing is already done.

Zero dependencies. ESM. ~6 kB packed.

```bash
npm i gof-patterns
```

```ts
import { stateMachine, chain, singleton } from 'gof-patterns';

const order = stateMachine({
  initial: 'draft',
  states: { draft: { pay: 'paid' }, paid: { ship: 'sent' }, sent: {} },
});
order.send('pay'); // 'paid'
order.send('pay'); // throws: "pay" is not allowed in "sent"
```

## When would I use this?

[**How to use it, and when**](https://github.com/Andrew-Tellez/patterns/blob/main/USE-CASES.md) walks through ten situations from real
code — a webhook with several payload shapes, an order that must not skip steps, a flaky
provider that needs retries — and says which helper each one calls for.

## The catalog

**All 22 patterns, all with a helper.** Where the language already has something better for
the job, the Notes column says so — use it and skip the helper.

### Creational

| Pattern | Helper | Notes |
| --- | --- | --- |
| Singleton | `singleton(factory)` | One lazy instance. `.reset()` for tests. |
| Factory Method | `registry()` | `register(key, creator)` / `create(key, ...args)` |
| Abstract Factory | `registry()` | One registry per family. |
| Builder | `builder<T>(defaults?, build?)` | Fluent setters, no class. |
| Prototype | `clone(value)` | Alias for `structuredClone`; import that directly if it is all you need. Does not copy functions or class prototypes. |

### Structural

| Pattern | Helper | Notes |
| --- | --- | --- |
| Adapter | `adapt(source, methods)` | |
| Bridge | `bridge(build, impl)` | Stable reference; `swap(impl)` redirects every caller that already holds it. |
| Composite | `composite(value, children?)` | `add`, `walk()`, `sum()` |
| Decorator | `decorate(fn, ...wrappers)` | Retry / cache / log layers. First wrapper is outermost. |
| Facade | `facade(subsystems, build)` | Subsystems are built lazily — only the ones the called operation touches. |
| Flyweight | `flyweight(factory, key?)` | Shared instances per key. |
| Proxy | `lazy(loader)` | Real object built on first access. |

### Behavioral

| Pattern | Helper | Notes |
| --- | --- | --- |
| Chain of Responsibility | `chain(handlers, fallback?)` | `(req, next) => res`, sync or async. |
| Command | `commandBus()` | `run`, `undo`, `redo` |
| Iterator | `iterate(cursor)` | Wraps a `hasNext`/`next` cursor into an iterable. Writing your own source? Use a generator instead. |
| Mediator | `mediator<Events>()` | Typed `on` / `emit` hub. |
| Memento | `history(initial, { limit?, snapshot? })` | Undo/redo over snapshots. |
| Observer | `subject<T>()` | `subscribe` returns the unsubscribe. |
| State | `stateMachine({ initial, states })` | |
| Strategy | `registry()` | Swap the registered implementation. |
| Template Method | `template(defaults, skeleton)` | Override single steps, no subclass. |
| Visitor | `visitor(visitors, fallback?)` | Dispatch on `node.type`. |

The original book describes 23 patterns; the Refactoring Guru catalog omits Interpreter, and
so does this package — a general-purpose interpreter helper is a parser generator, not a
pattern helper.

## Examples

**Decorator** — layers, outermost first:

```ts
const withRetry = (n: number) => (next) => async (...args) => {
  for (let i = 0; ; i++) {
    try { return await next(...args); } catch (e) { if (i >= n) throw e; }
  }
};
const fetchUser = decorate(rawFetchUser, withLog, withRetry(3));
```

**Chain of Responsibility** — first handler that answers wins:

```ts
const route = chain<Ticket, string>(
  [(t, next) => (t.level === 1 ? 'bot' : next()),
   (t, next) => (t.paid ? 'human' : next())],
  () => 'queue',
);
```

**Memento** — undo over snapshots (pass `snapshot` if you mutate state in place):

```ts
const h = history({ text: '' }, { limit: 50, snapshot: structuredClone });
h.save({ text: 'hi' });
h.undo(); // { text: '' }
```

## Development

```bash
npm test          # node --test, no framework
npm run build     # tsc
```

## License

MIT
