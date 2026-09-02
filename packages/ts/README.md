# @andrew-tellez/patterns

The [Gang of Four catalog](https://refactoring.guru/design-patterns/catalog) as tiny, typed
helpers. You write the domain logic; the pattern plumbing is already done.

Zero dependencies. ESM. ~6 kB packed.

```bash
npm i @andrew-tellez/patterns
```

```ts
import { stateMachine, chain, singleton } from '@andrew-tellez/patterns';

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

### Creational

| Pattern | Helper |
| --- | --- |
| Singleton | `singleton(factory)` — one lazy instance, `.reset()` for tests |
| Factory Method | `registry()` — `register(key, creator)` / `create(key, ...args)` |
| Abstract Factory | `registry()` — one registry per family |
| Builder | `builder<T>(defaults?, build?)` — fluent setters, no class |
| Prototype | `clone(value)` — thin alias for `structuredClone` |

### Structural

| Pattern | Helper |
| --- | --- |
| Adapter | `adapt(source, methods)` |
| Decorator | `decorate(fn, ...wrappers)` — retry/cache/log layers |
| Composite | `composite(value, children?)` — `add`, `walk()`, `sum()` |
| Flyweight | `flyweight(factory, key?)` — shared instances per key |
| Proxy | `lazy(loader)` — real object built on first access |
| Facade | *no helper* — an object that delegates. Just write it. |
| Bridge | *no helper* — pass the implementation in. Just write it. |

### Behavioral

| Pattern | Helper |
| --- | --- |
| Chain of Responsibility | `chain(handlers, fallback?)` — `(req, next) => res`, sync or async |
| Command | `commandBus()` — `run`, `undo`, `redo` |
| Observer | `subject<T>()` — `subscribe` returns the unsubscribe |
| Mediator | `mediator<Events>()` — typed `on` / `emit` hub |
| Memento | `history(initial, { limit?, snapshot? })` — undo/redo |
| State | `stateMachine({ initial, states })` |
| Strategy | `registry()` — swap the registered implementation |
| Visitor | `visitor(visitors, fallback?)` — dispatch on `node.type` |
| Template Method | `template(defaults, skeleton)` — override single steps |
| Iterator | *no helper* — generators and `for...of` are in the language |

Five entries have no helper on purpose: a wrapper there would be more code to read
than the pattern it hides. The table says what to write instead.

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
