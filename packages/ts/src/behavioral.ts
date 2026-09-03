/** Behavioral patterns. */

/**
 * Chain of Responsibility — each handler either answers or calls `next()`.
 * Works for sync and async (`Res` can be a Promise).
 *
 * ```ts
 * const support = chain<Ticket, string>(
 *   [(t, next) => (t.level === 1 ? 'bot' : next()), (t, next) => (t.paid ? 'human' : next())],
 *   () => 'queue',
 * );
 * ```
 */
export type Handler<Req, Res> = (request: Req, next: () => Res) => Res;

export function chain<Req, Res>(
  handlers: Handler<Req, Res>[],
  fallback?: (request: Req) => Res,
): (request: Req) => Res {
  return (request) => {
    const step = (i: number): Res => {
      const handler = handlers[i];
      if (!handler) {
        if (!fallback) throw new Error('chain: no handler answered and no fallback was given');
        return fallback(request);
      }
      return handler(request, () => step(i + 1));
    };
    return step(0);
  };
}

/**
 * Command — undoable operations with history.
 *
 * ```ts
 * const bus = commandBus();
 * bus.run({ do: () => doc.push('a'), undo: () => doc.pop() });
 * bus.undo();
 * bus.redo();
 * ```
 * A command without `undo` clears the redo stack and cannot be undone.
 */
export type Command<T = unknown> = { do(): T; undo?(): void };

export type CommandBus = {
  run<T>(command: Command<T>): T;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
};

export function commandBus(): CommandBus {
  const done: Command[] = [];
  let undone: Command[] = [];
  return {
    run(command) {
      const result = command.do();
      undone = [];
      if (command.undo) done.push(command as Command);
      return result;
    },
    undo() {
      const command = done.pop();
      if (!command) return false;
      command.undo?.();
      undone.push(command);
      return true;
    },
    redo() {
      const command = undone.pop();
      if (!command) return false;
      command.do();
      done.push(command);
      return true;
    },
    canUndo: () => done.length > 0,
    canRedo: () => undone.length > 0,
  };
}

/**
 * Observer — one typed channel. `subscribe` returns the unsubscribe function.
 *
 * ```ts
 * const priceChanged = subject<number>();
 * const off = priceChanged.subscribe((p) => render(p));
 * priceChanged.emit(9.99);
 * off();
 * ```
 */
export type Subject<T> = {
  subscribe(listener: (value: T) => void): () => void;
  emit(value: T): void;
  size(): number;
};

export function subject<T>(): Subject<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    // Iterate a copy: a listener may unsubscribe during emit.
    emit: (value) => [...listeners].forEach((listener) => listener(value)),
    size: () => listeners.size,
  };
}

/**
 * Mediator — components talk to a typed hub, never to each other.
 *
 * ```ts
 * const hub = mediator<{ login: { id: string }; logout: void }>();
 * hub.on('login', ({ id }) => track(id));
 * hub.emit('login', { id: 'u1' });
 * ```
 */
export type Mediator<E extends Record<string, unknown>> = {
  on<K extends keyof E>(event: K, listener: (payload: E[K]) => void): () => void;
  emit<K extends keyof E>(event: K, payload: E[K]): void;
};

export function mediator<E extends Record<string, unknown>>(): Mediator<E> {
  const channels = new Map<keyof E, Subject<E[keyof E]>>();
  const channel = <K extends keyof E>(event: K) => {
    let existing = channels.get(event);
    if (!existing) channels.set(event, (existing = subject()));
    return existing as Subject<E[K]>;
  };
  return {
    on: (event, listener) => channel(event).subscribe(listener),
    emit: (event, payload) => channel(event).emit(payload),
  };
}

/**
 * Memento — undo/redo over snapshots of state.
 *
 * ```ts
 * const h = history({ text: '' });
 * h.save({ text: 'hi' });
 * h.undo(); // { text: '' }
 * ```
 * Snapshots are stored by reference — pass a copy, or a `snapshot` function,
 * if the state object is mutated in place.
 */
export type History<T> = {
  current(): T;
  save(state: T): void;
  undo(): T | undefined;
  redo(): T | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
};

export function history<T>(
  initial: T,
  // `NoInfer` on snapshot matters: without it, passing a generic function such as
  // `structuredClone` makes T infer as `{}` and the history loses its type. Found
  // by writing examples/07-undo, where it turned `.undo()?.tags` into an error.
  options: { limit?: number; snapshot?: (state: NoInfer<T>) => NoInfer<T> } = {},
): History<T> {
  const { limit = Infinity, snapshot = (state: T) => state } = options;
  const past: T[] = [];
  const future: T[] = [];
  let present = snapshot(initial);
  return {
    current: () => present,
    save(state) {
      past.push(present);
      if (past.length > limit) past.shift();
      future.length = 0;
      present = snapshot(state);
    },
    undo() {
      if (!past.length) return undefined;
      future.push(present);
      return (present = past.pop() as T);
    },
    redo() {
      if (!future.length) return undefined;
      past.push(present);
      return (present = future.pop() as T);
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}

/**
 * State — a finite state machine from a transition table.
 *
 * ```ts
 * const order = stateMachine({
 *   initial: 'draft',
 *   states: { draft: { pay: 'paid' }, paid: { ship: 'sent' }, sent: {} },
 * });
 * order.send('pay');  // 'paid'
 * order.can('ship');  // true
 * ```
 * A transition value may be a target state or `(payload) => target`.
 */
export type Transitions<S extends string, E extends string> = Record<
  S,
  Partial<Record<E, S | ((payload: unknown) => S)>>
>;

export type StateMachine<S extends string, E extends string> = {
  state(): S;
  can(event: E): boolean;
  /** Returns the new state. Throws on an event the current state does not allow. */
  send(event: E, payload?: unknown): S;
  onChange(listener: (change: { from: S; to: S; event: E }) => void): () => void;
};

export function stateMachine<S extends string, E extends string>(config: {
  initial: S;
  states: Transitions<S, E>;
}): StateMachine<S, E> {
  let state = config.initial;
  const changes = subject<{ from: S; to: S; event: E }>();
  const target = (event: E) => config.states[state]?.[event];
  return {
    state: () => state,
    can: (event) => target(event) !== undefined,
    send(event, payload) {
      const to = target(event);
      if (to === undefined) throw new Error(`stateMachine: "${event}" is not allowed in "${state}"`);
      const from = state;
      // S extends string, so a function value is always the dynamic-target form.
      state = typeof to === 'function' ? (to as (payload: unknown) => S)(payload) : (to as S);
      changes.emit({ from, to: state, event });
      return state;
    },
    onChange: (listener) => changes.subscribe(listener),
  };
}

/**
 * Visitor — dispatch on a node's kind instead of a switch scattered everywhere.
 *
 * ```ts
 * const area = visitor<Shape, number>({
 *   circle: (c) => Math.PI * c.r ** 2,
 *   square: (s) => s.side ** 2,
 * });
 * area({ type: 'circle', r: 1 });
 * ```
 */
export function visitor<N extends { type: string }, R>(
  visitors: { [K in N['type']]?: (node: Extract<N, { type: K }>) => R },
  fallback?: (node: N) => R,
): (node: N) => R {
  return (node) => {
    const visit = visitors[node.type as N['type']] as ((n: N) => R) | undefined;
    if (visit) return visit(node);
    if (fallback) return fallback(node);
    throw new Error(`visitor: no visitor for "${node.type}"`);
  };
}

/**
 * Template Method — a fixed skeleton with replaceable steps.
 *
 * ```ts
 * const mine = template({ read: () => csv(), parse: (s: string) => s.split(',') },
 *   (hooks) => hooks.parse(hooks.read()));
 * mine({ read: () => 'a,b' })(); // ['a', 'b']
 * ```
 */
export function template<H extends Record<string, (...args: never[]) => unknown>, A extends unknown[], R>(
  defaults: H,
  skeleton: (hooks: H, ...args: A) => R,
): (overrides?: Partial<H>) => (...args: A) => R {
  return (overrides) => (...args) => skeleton({ ...defaults, ...overrides }, ...args);
}

// ponytail: Iterator is a generator function plus `for...of` — already in the
// language, so there is no helper for it.

/**
 * Iterator — turn an external cursor into something `for...of` can walk.
 *
 * Database cursors, paginated HTTP APIs and vendor SDKs hand you a
 * `hasNext()` / `next()` pair. This makes that a real iterable, so spread,
 * destructuring, `for...of` and early `break` all work:
 *
 * ```ts
 * for (const row of iterate(dbCursor)) {
 *   if (row.id === target) break;   // the cursor stops here
 * }
 * ```
 *
 * Lazy: `next()` is called only when the consumer asks for the next value. If you
 * are writing the source yourself, a generator function is simpler — this is for
 * sources you did not write.
 */
export function iterate<T>(source: { hasNext(): boolean; next(): T }): IterableIterator<T> {
  function* walk(): Generator<T> {
    while (source.hasNext()) yield source.next();
  }
  return walk();
}
