/** Creational patterns. */

/**
 * Singleton — one lazily created instance, shared.
 *
 * ```ts
 * const db = singleton(() => connect(url));
 * db() === db(); // same instance
 * db.reset();    // drop it (tests)
 * ```
 */
export function singleton<T>(factory: () => T): (() => T) & { reset(): void } {
  let value: T;
  let made = false;
  const get = () => {
    if (!made) {
      value = factory();
      made = true;
    }
    return value;
  };
  get.reset = () => {
    made = false;
    value = undefined as T;
  };
  return get;
}

/**
 * Factory Method / Abstract Factory / Strategy — a registry keyed by name.
 *
 * ```ts
 * const shapes = registry<{ circle: (r: number) => Shape }>();
 * shapes.register('circle', (r) => new Circle(r));
 * shapes.create('circle', 2);
 * ```
 */
export type Registry<M extends Record<string, (...args: never[]) => unknown>> = {
  register<K extends keyof M>(key: K, creator: M[K]): void;
  create<K extends keyof M>(key: K, ...args: Parameters<M[K]>): ReturnType<M[K]>;
  has(key: PropertyKey): boolean;
  keys(): (keyof M)[];
};

export function registry<M extends Record<string, (...args: never[]) => unknown>>(
  initial?: Partial<M>,
): Registry<M> {
  const map = new Map<PropertyKey, unknown>(Object.entries(initial ?? {}));
  return {
    register: (key, creator) => void map.set(key, creator),
    create: (key, ...args) => {
      const creator = map.get(key) as ((...a: unknown[]) => unknown) | undefined;
      if (!creator) throw new Error(`registry: nothing registered for "${String(key)}"`);
      return creator(...args) as never;
    },
    has: (key) => map.has(key),
    keys: () => [...map.keys()] as (keyof M)[],
  };
}

/**
 * Builder — fluent setters for a plain object, no class boilerplate.
 *
 * ```ts
 * const pizza = builder<Pizza>({ size: 'M' }).cheese(true).size('L').build();
 * ```
 * Pass `build` to validate or construct something else at the end.
 */
export type Builder<T, R = T> = { [K in keyof T]-?: (value: T[K]) => Builder<T, R> } & {
  build(): R;
};

export function builder<T extends object, R = T>(
  defaults?: Partial<T>,
  build?: (draft: Partial<T>) => R,
): Builder<T, R> {
  const draft: Partial<T> = { ...defaults };
  const proxy = new Proxy({} as Builder<T, R>, {
    get(_t, prop) {
      if (prop === 'build') return () => (build ? build(draft) : ({ ...draft } as unknown as R));
      return (value: unknown) => {
        draft[prop as keyof T] = value as T[keyof T];
        return proxy;
      };
    },
  });
  return proxy;
}

// ponytail: Prototype is `structuredClone` in the stdlib. Re-exported so the
// catalog is complete; it does not copy functions or class prototypes.
export const clone = <T>(value: T): T => structuredClone(value);
