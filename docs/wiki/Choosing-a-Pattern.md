# Choosing a Pattern

Patterns get misused when you start from the name. Start from the smell instead.

## By symptom

| What your code looks like | Reach for | Helper |
| --- | --- | --- |
| A growing `switch`/`if` chain that maps a string to a `new Thing()` | Factory Method | `registry` / `Registry` |
| The same `switch` chain, but choosing *behaviour* rather than a type | Strategy | `registry` / `Registry` |
| A function whose parameter list keeps growing, half of it optional | Builder | `builder` (TS); keyword args (Python) |
| Two objects that do the same job with different method names | Adapter | `adapt` |
| Cross-cutting noise (logging, retry, cache) copied into many functions | Decorator | `decorate` |
| Nested `if (node.children)` recursion repeated in several places | Composite | `composite` / `Composite` |
| Thousands of near-identical objects, mostly the same field values | Flyweight | `flyweight` / `Flyweight` |
| A driver or SDK that hands you `hasNext()` / `next()` | Iterator | `iterate` |
| Six subsystems behind one entry point, most calls touching one | Facade | `facade` |
| An implementation you need to swap while callers hold the reference | Bridge | `bridge` |
| An expensive object built at startup that most requests never touch | Proxy | `lazy` |
| A validation or routing sequence with early exit, wired by hand | Chain of Responsibility | `chain` |
| A feature request for undo | Command *or* Memento | `commandBus` / `history` |
| `if (a) { ... } else if (b)` scattered across files, all reading one flag | State | `stateMachine` / `StateMachine` |
| A boolean pair like `isPaid` + `isShipped` that can be both false and both true | State | `stateMachine` / `StateMachine` |
| Modules importing each other to notify each other | Observer or Mediator | `subject` / `mediator` |
| Two functions that differ in one middle step | Template Method | `template` |
| A `switch (node.type)` repeated for every new operation on a tree | Visitor | `visitor` |

## Command or Memento?

Both give you undo, and picking wrong hurts later.

- **Command** — you can describe the *inverse* of each action. `add(x)` undone by `remove(x)`.
  Cheap, and it survives large state. Use `commandBus` / `CommandBus`.
- **Memento** — you cannot describe the inverse, so you keep whole snapshots. Simple and
  always correct, but memory grows with state size × history depth. Use `history` / `History`
  with a `limit`, and pass `snapshot` (`structuredClone`, `copy.deepcopy`) if you mutate
  state in place. Without it, snapshots are stored by reference and your history will quietly
  contain the same mutated object several times.

## Observer or Mediator?

- **Observer** (`subject`) — one publisher, one kind of event. A price changed; several
  things react.
- **Mediator** (`mediator` / `Mediator`) — many components, many event kinds, and you want
  them to stop importing each other. A hub with named channels.

If there is exactly one event, `mediator` is a dictionary you did not need. Use `subject`.

## State machine or a boolean?

Use the state machine when the states are **mutually exclusive** and the transitions are
**not all legal**. `draft → paid → sent` is a state machine; an order cannot be paid and
draft at once, and `sent` cannot go back to `draft`.

Two independent booleans — `isArchived`, `isStarred` — are not states. Four combinations, all
legal. Leave them as booleans.

The payoff is the error: `send('pay')` on a `sent` order throws with the state and the event
in the message, at the moment the illegal thing was attempted, instead of producing a wrong
row you find next week.

## When not to use any of this

- **One implementation, forever.** A factory with one product, an interface with one
  implementer, a strategy registry with one strategy — that is indirection, not design. Add
  the pattern when the second case actually arrives.
- **The pattern is bigger than the problem.** A `chain` of one handler is an `if`.
- **The stdlib does it better.** Every pattern has a helper, but for some of them the
  language got there first. [Stdlib Equivalents](Stdlib-Equivalents) says which, and when.
