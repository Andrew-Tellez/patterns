/** Structural patterns. */

/**
 * Adapter — expose an incompatible object through the interface you want.
 *
 * ```ts
 * const logger = adapt(winston, { log: (w) => (m: string) => w.info(m) });
 * ```
 */
export function adapt<S, A extends Record<string, (source: S) => unknown>>(
  source: S,
  methods: A,
): { [K in keyof A]: ReturnType<A[K]> } {
  const out = {} as { [K in keyof A]: ReturnType<A[K]> };
  for (const key of Object.keys(methods) as (keyof A)[]) {
    out[key] = methods[key](source) as ReturnType<A[keyof A]>;
  }
  return out;
}

/**
 * Decorator — wrap a function in layers (retry, cache, log) without touching it.
 * Applied left to right: the first wrapper is the outermost.
 *
 * ```ts
 * const fetchUser = decorate(rawFetchUser, withLog, withRetry(3));
 * ```
 */
export type Wrapper<F extends (...args: never[]) => unknown> = (next: F) => F;

export function decorate<F extends (...args: never[]) => unknown>(
  fn: F,
  ...wrappers: Wrapper<F>[]
): F {
  return wrappers.reduceRight((next, wrap) => wrap(next), fn);
}

/**
 * Composite — treat a tree of nodes like a single node.
 *
 * ```ts
 * const box = composite({ price: 10 });
 * box.add(composite({ price: 5 }));
 * box.sum((n) => n.price); // 15
 * ```
 */
export type Composite<T> = {
  readonly value: T;
  readonly children: Composite<T>[];
  add(...children: Composite<T>[]): Composite<T>;
  remove(child: Composite<T>): boolean;
  /** Depth-first, self first. */
  walk(): Generator<Composite<T>>;
  sum(of: (value: T) => number): number;
};

export function composite<T>(value: T, children: Composite<T>[] = []): Composite<T> {
  const node: Composite<T> = {
    value,
    children,
    add(...kids) {
      children.push(...kids);
      return node;
    },
    remove(child) {
      const i = children.indexOf(child);
      if (i < 0) return false;
      children.splice(i, 1);
      return true;
    },
    *walk() {
      yield node;
      for (const child of children) yield* child.walk();
    },
    sum(of) {
      let total = 0;
      for (const n of node.walk()) total += of(n.value);
      return total;
    },
  };
  return node;
}

/**
 * Flyweight — share immutable instances instead of re-creating them.
 *
 * ```ts
 * const treeType = flyweight((name: string, color: string) => ({ name, color }));
 * treeType('oak', 'green') === treeType('oak', 'green'); // true
 * ```
 * Default key is `JSON.stringify(args)`; pass `key` for anything richer.
 */
export function flyweight<A extends unknown[], T>(
  factory: (...args: A) => T,
  key: (...args: A) => string = (...args) => JSON.stringify(args),
): ((...args: A) => T) & { size(): number; clear(): void } {
  const cache = new Map<string, T>();
  const get = (...args: A): T => {
    const k = key(...args);
    if (!cache.has(k)) cache.set(k, factory(...args));
    return cache.get(k) as T;
  };
  get.size = () => cache.size;
  get.clear = () => cache.clear();
  return get;
}

/**
 * Proxy (virtual) — build the real object on first property access.
 *
 * ```ts
 * const heavy = lazy(() => loadHugeThing()); // nothing loaded yet
 * heavy.query('x');                          // loads now, once
 * ```
 */
export function lazy<T extends object>(loader: () => T): T {
  let target: T | undefined;
  const get = () => (target ??= loader());
  return new Proxy({} as T, {
    get: (_t, prop, receiver) => Reflect.get(get(), prop, receiver),
    set: (_t, prop, value) => Reflect.set(get(), prop, value),
    has: (_t, prop) => Reflect.has(get(), prop),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, prop) => Reflect.getOwnPropertyDescriptor(get(), prop),
  });
}

// ponytail: Facade and Bridge are plain composition — an object or class that
// delegates. No runtime helper can make that shorter than writing it. See README.

/**
 * Facade — one small interface over several subsystems, each built only if the
 * operation you called actually needs it.
 *
 * ```ts
 * const checkout = facade(
 *   { payments: () => new PaymentClient(key), mail: () => new Mailer(smtp) },
 *   (parts) => ({
 *     pay: (cents: number) => parts.payments.charge(cents),
 *     receipt: (to: string) => parts.mail.send(to),
 *   }),
 * );
 * checkout.pay(1999); // Mailer was never constructed
 * ```
 *
 * Without the lazy part this would be `build(parts)` and not worth a helper. With
 * it, a facade over six subsystems costs one subsystem per call.
 */
export function facade<S extends Record<string, () => unknown>, A>(
  subsystems: S,
  build: (parts: { [K in keyof S]: ReturnType<S[K]> }) => A,
): A {
  const built = new Map<keyof S, unknown>();
  const parts = new Proxy({} as { [K in keyof S]: ReturnType<S[K]> }, {
    get(_t, prop) {
      const key = prop as keyof S;
      if (!built.has(key)) built.set(key, subsystems[key]());
      return built.get(key);
    },
  });
  return build(parts);
}

/**
 * Bridge — a stable abstraction whose implementation can be swapped underneath it.
 *
 * ```ts
 * const storage = bridge((impl: Storage) => ({
 *   save: (k: string, v: string) => impl.put(k, v),
 * }), new S3Storage());
 *
 * store(storage);            // callers keep this reference forever
 * storage.swap(new DiskStorage());  // and now they are writing to disk
 * ```
 *
 * The point is the *stable reference*: callers that captured `storage` follow the
 * swap. Passing the implementation into a constructor — the textbook version — makes
 * every caller re-wire when it changes.
 */
export function bridge<Impl, Api extends object>(
  build: (implementation: Impl) => Api,
  implementation: Impl,
): Api & { swap(next: Impl): void } {
  let current = build(implementation);
  return new Proxy({} as Api & { swap(next: Impl): void }, {
    get(_t, prop, receiver) {
      if (prop === 'swap') return (next: Impl) => void (current = build(next));
      return Reflect.get(current, prop, receiver);
    },
    has: (_t, prop) => prop === 'swap' || Reflect.has(current, prop),
    ownKeys: () => Reflect.ownKeys(current),
    getOwnPropertyDescriptor: (_t, prop) => Reflect.getOwnPropertyDescriptor(current, prop),
  });
}
