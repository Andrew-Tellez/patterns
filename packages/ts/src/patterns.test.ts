import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adapt, builder, chain, clone, commandBus, composite, decorate, flyweight, history,
  lazy, mediator, registry, singleton, stateMachine, subject, template, visitor,
} from './index.ts';

test('singleton builds once and resets', () => {
  let calls = 0;
  const get = singleton(() => ({ n: ++calls }));
  assert.equal(get(), get());
  assert.equal(calls, 1);
  get.reset();
  assert.equal(get().n, 2);
});

test('registry creates by key and rejects unknown keys', () => {
  const shapes = registry<{ circle: (r: number) => object }>();
  shapes.register('circle', (r) => ({ r }));
  assert.deepEqual(shapes.create('circle', 2), { r: 2 });
  assert.deepEqual(shapes.keys(), ['circle']);
  // @ts-expect-error unknown key
  assert.throws(() => shapes.create('square'), /nothing registered/);
});

test('builder merges defaults with fluent setters', () => {
  const pizza = builder<{ size: string; cheese: boolean }>({ size: 'M' }).cheese(true).size('L').build();
  assert.deepEqual(pizza, { size: 'L', cheese: true });
});

test('builder runs the build function', () => {
  const make = builder<{ n: number }, string>({}, (d) => `n=${d.n}`);
  assert.equal(make.n(3).build(), 'n=3');
});

test('clone is deep', () => {
  const source = { a: { b: 1 } };
  const copy = clone(source);
  copy.a.b = 2;
  assert.equal(source.a.b, 1);
});

test('adapt exposes the wanted interface', () => {
  const legacy = { sendMessage: (m: string) => `sent:${m}` };
  const api = adapt(legacy, { log: (l) => (m: string) => l.sendMessage(m) });
  assert.equal(api.log('hi'), 'sent:hi');
});

test('decorate applies wrappers outermost-first', () => {
  const order: string[] = [];
  const base = decorate(
    () => 'core',
    (next) => () => { order.push('outer'); return next(); },
    (next) => () => { order.push('inner'); return next(); },
  );
  assert.equal(base(), 'core');
  assert.deepEqual(order, ['outer', 'inner']);
});

test('composite aggregates over the tree', () => {
  const root = composite({ price: 10 });
  const child = composite({ price: 5 });
  root.add(child, composite({ price: 1 }));
  assert.equal(root.sum((v) => v.price), 16);
  assert.equal([...root.walk()].length, 3);
  assert.equal(root.remove(child), true);
  assert.equal(root.sum((v) => v.price), 11);
  assert.equal(root.remove(child), false);
});

test('flyweight shares instances per key', () => {
  let built = 0;
  const type = flyweight((name: string) => ({ name, id: ++built }));
  assert.equal(type('oak'), type('oak'));
  assert.notEqual(type('oak'), type('pine'));
  assert.equal(type.size(), 2);
  type.clear();
  assert.equal(type.size(), 0);
});

test('lazy defers construction to first access', () => {
  let loaded = 0;
  const thing = lazy(() => ({ loaded: ++loaded, value: 7 }));
  assert.equal(loaded, 0);
  assert.equal(thing.value, 7);
  assert.equal(thing.value, 7);
  assert.equal(loaded, 1);
  assert.equal('value' in thing, true);
});

test('chain stops at the first handler that answers', () => {
  const route = chain<{ level: number }, string>(
    [(t, next) => (t.level === 1 ? 'bot' : next()), (t, next) => (t.level === 2 ? 'human' : next())],
    () => 'queue',
  );
  assert.equal(route({ level: 1 }), 'bot');
  assert.equal(route({ level: 2 }), 'human');
  assert.equal(route({ level: 9 }), 'queue');
  assert.throws(() => chain<number, string>([])(1), /no fallback/);
});

test('commandBus undoes and redoes', () => {
  const doc: string[] = [];
  const bus = commandBus();
  const push = (c: string) => bus.run({ do: () => doc.push(c), undo: () => void doc.pop() });
  push('a');
  push('b');
  assert.deepEqual(doc, ['a', 'b']);
  bus.undo();
  assert.deepEqual(doc, ['a']);
  bus.redo();
  assert.deepEqual(doc, ['a', 'b']);
  assert.equal(bus.canRedo(), false);
  bus.undo();
  bus.undo();
  assert.equal(bus.undo(), false);
});

test('subject notifies and unsubscribes safely mid-emit', () => {
  const seen: number[] = [];
  const s = subject<number>();
  const off = s.subscribe((n) => { seen.push(n); off(); });
  s.subscribe((n) => seen.push(n * 10));
  s.emit(1);
  s.emit(2);
  assert.deepEqual(seen, [1, 10, 20]);
  assert.equal(s.size(), 1);
});

test('mediator keeps channels separate', () => {
  const hub = mediator<{ login: { id: string }; logout: null }>();
  const seen: string[] = [];
  hub.on('login', ({ id }) => seen.push(id));
  hub.on('logout', () => seen.push('out'));
  hub.emit('login', { id: 'u1' });
  hub.emit('logout', null);
  assert.deepEqual(seen, ['u1', 'out']);
});

test('history undoes, redoes and drops the future on save', () => {
  const h = history('');
  h.save('a');
  h.save('ab');
  assert.equal(h.undo(), 'a');
  assert.equal(h.redo(), 'ab');
  h.undo();
  h.save('ax');
  assert.equal(h.canRedo(), false);
  assert.equal(h.current(), 'ax');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), '');
  assert.equal(h.undo(), undefined);
});

test('history honours the limit', () => {
  const h = history(0, { limit: 1 });
  h.save(1);
  h.save(2);
  assert.equal(h.undo(), 1);
  assert.equal(h.canUndo(), false);
});

test('stateMachine transitions and rejects bad events', () => {
  const order = stateMachine<'draft' | 'paid' | 'sent', 'pay' | 'ship'>({
    initial: 'draft',
    states: { draft: { pay: 'paid' }, paid: { ship: 'sent' }, sent: {} },
  });
  const changes: string[] = [];
  order.onChange(({ from, to }) => changes.push(`${from}->${to}`));
  assert.equal(order.can('ship'), false);
  assert.equal(order.send('pay'), 'paid');
  assert.equal(order.send('ship'), 'sent');
  assert.deepEqual(changes, ['draft->paid', 'paid->sent']);
  assert.throws(() => order.send('pay'), /not allowed in "sent"/);
});

test('visitor dispatches by type with a fallback', () => {
  type Shape = { type: 'circle'; r: number } | { type: 'square'; side: number };
  const area = visitor<Shape, number>({ circle: (c) => Math.PI * c.r ** 2, square: (s) => s.side ** 2 });
  assert.equal(area({ type: 'square', side: 3 }), 9);
  const partial = visitor<Shape, number>({ square: (s) => s.side ** 2 }, () => -1);
  assert.equal(partial({ type: 'circle', r: 1 }), -1);
  assert.throws(() => visitor<Shape, number>({})({ type: 'circle', r: 1 }), /no visitor/);
});

test('template replaces only the overridden steps', () => {
  const run = template(
    { read: () => 'a,b', parse: (s: string) => s.split(',') },
    (hooks) => hooks.parse(hooks.read()),
  );
  assert.deepEqual(run()(), ['a', 'b']);
  assert.deepEqual(run({ read: () => 'x,y,z' })(), ['x', 'y', 'z']);
});
