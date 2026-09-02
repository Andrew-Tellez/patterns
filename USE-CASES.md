# How to use it, and when

Every helper follows the same three rules, so learning one teaches you the rest.

1. **You pass the behaviour in.** The helper owns the bookkeeping — the listener set, the
   undo stack, the transition table, the cache. Your domain logic goes in as a function.
2. **You get back a plain function or object.** Nothing to extend, no base class, no
   decorator magic, no lifecycle. It composes with whatever you already have.
3. **Wrong usage fails loudly.** An unknown registry key, an illegal transition, a chain with
   no answer — all throw with the key, the state and the event in the message, at the moment
   it happened.

```bash
npm i gof-patterns   # TypeScript / JavaScript
pip install gof-patterns  # Python
```

```ts
import { chain, stateMachine, decorate } from 'gof-patterns';
```

```python
from gof_patterns import chain, StateMachine, decorate
```

Every example below is executed as a test in
[`packages/ts/src/use-cases.test.ts`](packages/ts/src/use-cases.test.ts). If a snippet here
stops working, CI fails.

## The situations

| Situation | Helper |
| --- | --- |
| [One webhook endpoint, several payload shapes](#one-webhook-endpoint-several-payload-shapes) | `chain` |
| [An order that must not skip steps](#an-order-that-must-not-skip-steps) | `stateMachine` |
| [A flaky provider that needs retry and logging](#a-flaky-provider-that-needs-retry-and-logging) | `decorate` |
| [Picking an implementation at runtime](#picking-an-implementation-at-runtime) | `registry` |
| [Two vendor SDKs behind one interface](#two-vendor-sdks-behind-one-interface) | `adapt` |
| [Undo in a cart or an editor](#undo-in-a-cart-or-an-editor) | `commandBus` / `history` |
| [One business event, several side effects](#one-business-event-several-side-effects) | `mediator` / `subject` |
| [A heavy client most requests never touch](#a-heavy-client-most-requests-never-touch) | `lazy` |
| [A tree you keep writing recursion over](#a-tree-you-keep-writing-recursion-over) | `composite` |
| [Two reports that differ in one step](#two-reports-that-differ-in-one-step) | `template` |

---

### One webhook endpoint, several payload shapes

Stripe sends cents in `data.total`, your SPEI provider sends pesos in `amount`, and next
quarter there is a third. The endpoint grows an `if/else if` ladder that everyone is afraid
to touch.

```ts
type Incoming = { source: string; amount?: number; data?: { total?: number } };

const normalize = chain<Incoming, { cents: number }>(
  [
    (e, next) => (e.source === 'stripe' ? { cents: e.data?.total ?? 0 } : next()),
    (e, next) => (e.source === 'spei' ? { cents: Math.round((e.amount ?? 0) * 100) } : next()),
  ],
  (e) => { throw new Error(`unknown source: ${e.source}`); },
);

normalize({ source: 'spei', amount: 19.99 }); // { cents: 1999 }
```

A third provider is one entry in the array — nothing else in the file moves. And the
fallback means an unrecognised payload throws with the source name instead of silently
normalising to zero.

**Python:** `chain([...], fallback=...)`, handlers take `(request, next_)`.

**Not this instead?** With two branches an `if` is fine. Reach for `chain` when the branches
have grown past three, or when different teams keep adding them.

---

### An order that must not skip steps

An order is `draft`, `paid`, `shipped` or `refunded`. Some transitions are legal, most are
not, and the rules currently live in four different services as `if (order.paid && !order.shipped)`.

```ts
const order = stateMachine<'draft' | 'paid' | 'shipped' | 'refunded', 'pay' | 'ship' | 'refund'>({
  initial: 'draft',
  states: {
    draft: { pay: 'paid' },
    paid: { ship: 'shipped', refund: 'refunded' },
    shipped: { refund: 'refunded' },
    refunded: {},
  },
});

order.onChange(({ from, to, event }) => audit.log(`${event}: ${from} -> ${to}`));

order.send('ship');   // throws: "ship" is not allowed in "draft"
order.send('pay');    // 'paid'
order.can('pay');     // false
```

The transition table *is* the rule, in one place, readable by someone who does not know the
codebase. `onChange` gives you an audit trail for free — every state change, with the event
that caused it, without touching the call sites.

**Python:** `StateMachine("draft", {...})`, `order.changes.subscribe(...)`.

**Not this instead?** Independent booleans — `isArchived`, `isStarred` — are not states. Four
combinations, all legal. Leave them as booleans.

---

### A flaky provider that needs retry and logging

The payment provider returns a 502 now and then. You need retries, and you want the log line
once per call, not once per attempt. Written inline, this logic ends up copied into every
function that calls out.

```ts
const withLog = (next: Charge): Charge => async (cents) => {
  logger.info(`charging ${cents}`);
  return next(cents);
};

const withRetry = (times: number) => (next: Charge): Charge => async (cents) => {
  for (let i = 0; ; i++) {
    try { return await next(cents); } catch (error) { if (i >= times) throw error; }
  }
};

const charge = decorate(rawCharge, withLog, withRetry(3));
```

Order is explicit and reads left to right: `withLog` is outermost, so it logs once and the
retries happen inside it. Swap the two arguments and you get a log line per attempt — which
is sometimes what you want, and now it is a one-line change instead of a rewrite.

**Python:** `decorate(raw_charge, with_log, with_retry(3))` — same order, and `functools.wraps`
is applied for you.

**Not this instead?** One wrapper on one function is just a wrapper. `decorate` pays off at
two or more layers, or when the same layers apply to several functions.

---

### Picking an implementation at runtime

Payments go out over Stripe, SPEI or a partner rail, chosen by a string that arrives in the
request. The naive version is a `switch` that imports all three at the top of the file.

```ts
const rails = registry<{ stripe: () => Rail; spei: (clabe: string) => Rail }>();

rails.register('stripe', () => new StripeRail(apiKey));
rails.register('spei', (clabe) => new SpeiRail(clabe));

rails.create('spei', '0123').send(1999);
rails.create('paypal');  // throws: nothing registered for "paypal"
```

This is Factory Method and Strategy at once — the difference is whether the registered thing
is an object or a behaviour, and the code is identical either way. Registration can live
next to each implementation, so adding a rail touches one new file and no existing one.

**Python:** `Registry()`, and `@shapes.register("circle")` works as a decorator.

**Not this instead?** A plain object literal `{ stripe, spei }` is enough when the set is
fixed and known at build time. `registry` earns its place when registration is distributed
or the key comes from outside.

---

### Two vendor SDKs behind one interface

Twilio wants `messages.create(to, body)`. SES wants `sendEmail({ to, text })`. Your code
should want neither.

```ts
const sms = adapt(twilio, {
  send: (t) => (to: string, text: string) => t.messages.create(to, text),
});
const email = adapt(ses, {
  send: (s) => (to: string, text: string) => s.sendEmail({ to, text }),
});

for (const channel of [sms, email]) channel.send(user.id, 'hi');
```

The adapters are the only place a vendor name appears. Swapping SES for Resend is one object
literal, and your tests can pass in a third adapter with no mocking library.

**Python:** `adapt(twilio, send=lambda t: t.messages.create)` — returns a `SimpleNamespace`.

---

### Undo in a cart or an editor

A feature request for undo arrives. There are two right answers and picking wrong hurts later.

```ts
const bus = commandBus();
const addItem = (sku: string) => bus.run({
  do: () => cart.push(sku),
  undo: () => void cart.splice(cart.lastIndexOf(sku), 1),
});

addItem('book');
bus.undo();   // true
bus.redo();   // true
```

Use **`commandBus`** when you can describe the inverse of each action — `add` undone by
`remove`. Cheap, and it does not care how large the state is.

Use **`history`** when you cannot, so you keep whole snapshots instead:

```ts
const doc = history(initialState, { limit: 50, snapshot: structuredClone });
doc.save(nextState);
doc.undo();
```

Pass `snapshot` whenever the state is mutated in place. Without it, snapshots are stored by
reference and the history quietly fills with the same mutated object.

**Python:** `CommandBus()` with `Do(do, undo=...)`, or `History(state, limit=50, snapshot=copy.deepcopy)`.

---

### One business event, several side effects

An invoice gets paid, and five things must happen: email the customer, update analytics,
write to the ledger, notify the CRM, refresh a cache. The handler that charges the card
should not import all five.

```ts
const hub = mediator<{ 'invoice.paid': { id: string; cents: number } }>();

hub.on('invoice.paid', ({ id }) => mailer.send(id));
hub.on('invoice.paid', ({ cents }) => analytics.track(cents));
const off = hub.on('invoice.paid', ({ id }) => ledger.write(id));

hub.emit('invoice.paid', { id: 'inv_1', cents: 1999 });
off();  // one subscriber removed; the publisher never knew it existed
```

The event names are typed, so a typo in `'invoice.pied'` is a compile error rather than a
handler that never fires — which is the failure mode that makes hand-rolled event buses
miserable to debug.

Use **`subject`** instead when there is exactly one kind of event: `mediator` would be a
dictionary you did not need.

**Python:** `Mediator()` with `hub.on("invoice.paid", ...)`, or `Subject[T]()` for one channel.

**Not this instead?** If the five effects must all succeed or all fail, you want a
transaction or a queue, not an event bus. `mediator` decouples; it does not give you
delivery guarantees.

---

### A heavy client most requests never touch

A report generator, a PDF renderer, an ML model — expensive to construct, used by 2% of
requests, and currently built at startup because that was easiest.

```ts
const reports = lazy(() => new ReportEngine(config));  // nothing built yet

app.get('/report', () => reports.render());            // built here, once
```

Boot stays fast and the call sites do not change — `reports` looks like the object it will
become. The construction cost moves to the first request that actually needs it.

**Python:** `lazy(ReportEngine)`; the stdlib alternative is `functools.cached_property` when
it hangs off an object you already have.

---

### A tree you keep writing recursion over

Category trees, org charts, a bill of materials, nested comments. Every new question about
the tree becomes another hand-written recursive walk, each with its own off-by-one.

```ts
const box = composite({ price: 10 }, [
  composite({ price: 5 }),
  composite({ price: 1 }),
]);

box.sum((item) => item.price);        // 16
[...box.walk()].filter(isFragile);    // depth-first, self first
```

`walk()` is a generator, so `for...of`, spread, `filter` and early `break` all work on it.
You write the question, not the traversal.

**Python:** `Composite(value, children)`, `walk()` yields, `len(root)` counts the subtree.

---

### Two reports that differ in one step

The daily report and the monthly report do the same four things; only the parsing differs.
Copy-paste gives you two functions that drift apart, and inheritance gives you a base class
nobody wants to touch.

```ts
const report = template(
  { read: readFromDb, parse: parseCsv, format: toTable },
  (hooks, range: string) => hooks.format(hooks.parse(hooks.read(range))),
);

const daily = report();
const monthly = report({ parse: parseJson });  // one step replaced
```

The skeleton is written once and the overridden step is visible at the call site, so a reader
sees exactly what is different about the monthly report without diffing two files.

**Python:** `template({...}, skeleton)`, then `report(parse=parse_json)`. An unknown step name
raises instead of being silently ignored.

---

## When not to use any of this

- **One implementation, forever.** A registry with one entry, a chain with one handler, a
  strategy with one strategy. That is indirection, not design. Add it when the second case
  actually shows up.
- **The standard library already has it.** Six of the 22 patterns have no helper in Python
  and five none in TypeScript, on purpose — see
  [Stdlib Equivalents](../../wiki/Stdlib-Equivalents).
- **You need guarantees, not structure.** A `mediator` is not a queue, a `stateMachine` is
  not a transaction, and `history` is not persistence. These helpers organise code that runs
  in one process; durability is a different problem.
