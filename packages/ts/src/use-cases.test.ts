/**
 * The code in USE-CASES.md, run as tests. If a scenario in that document stops
 * working, this file fails — the examples are a tested claim, not prose.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adapt, bridge, builder, chain, clone, commandBus, decorate, facade, flyweight, iterate,
  mediator, registry, singleton, stateMachine, visitor,
} from './index.ts';

test('use case: one webhook endpoint, several provider payload shapes', () => {
  type Incoming = { source: string; amount?: number; data?: { total?: number } };

  const normalize = chain<Incoming, { cents: number }>(
    [
      (e, next) => (e.source === 'stripe' ? { cents: e.data?.total ?? 0 } : next()),
      (e, next) => (e.source === 'spei' ? { cents: Math.round((e.amount ?? 0) * 100) } : next()),
    ],
    (e) => {
      throw new Error(`unknown source: ${e.source}`);
    },
  );

  assert.deepEqual(normalize({ source: 'stripe', data: { total: 1999 } }), { cents: 1999 });
  assert.deepEqual(normalize({ source: 'spei', amount: 19.99 }), { cents: 1999 });
  assert.throws(() => normalize({ source: 'paypal' }), /unknown source: paypal/);
});

test('use case: an order that must not skip steps', () => {
  const order = stateMachine<'draft' | 'paid' | 'shipped' | 'refunded', 'pay' | 'ship' | 'refund'>({
    initial: 'draft',
    states: {
      draft: { pay: 'paid' },
      paid: { ship: 'shipped', refund: 'refunded' },
      shipped: { refund: 'refunded' },
      refunded: {},
    },
  });

  const audit: string[] = [];
  order.onChange(({ from, to, event }) => audit.push(`${event}: ${from} -> ${to}`));

  assert.throws(() => order.send('ship'), /"ship" is not allowed in "draft"/);
  order.send('pay');
  order.send('ship');
  assert.equal(order.can('pay'), false);
  assert.deepEqual(audit, ['pay: draft -> paid', 'ship: paid -> shipped']);
});

test('use case: a flaky provider call that needs retry and logging', async () => {
  type Charge = (cents: number) => Promise<string>;
  let attempts = 0;
  const rawCharge: Charge = async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('502 from provider');
    return 'ch_123';
  };

  const log: string[] = [];
  const withLog = (next: Charge): Charge => async (cents) => {
    log.push(`charging ${cents}`);
    return next(cents);
  };
  const withRetry = (times: number) => (next: Charge): Charge => async (cents) => {
    for (let i = 0; ; i++) {
      try {
        return await next(cents);
      } catch (error) {
        if (i >= times) throw error;
      }
    }
  };

  const charge = decorate(rawCharge, withLog, withRetry(3));
  assert.equal(await charge(1999), 'ch_123');
  assert.equal(attempts, 3);
  assert.deepEqual(log, ['charging 1999']); // logged once, not once per retry
});

test('use case: picking a payment rail at runtime', () => {
  type Rail = { send(cents: number): string };
  const rails = registry<{ stripe: () => Rail; spei: (clabe: string) => Rail }>();

  rails.register('stripe', () => ({ send: (cents) => `stripe:${cents}` }));
  rails.register('spei', (clabe) => ({ send: (cents) => `spei:${clabe}:${cents}` }));

  assert.equal(rails.create('stripe').send(500), 'stripe:500');
  assert.equal(rails.create('spei', '0123').send(500), 'spei:0123:500');
  assert.deepEqual(rails.keys().sort(), ['spei', 'stripe']);
});

test('use case: two vendor SDKs behind one interface', () => {
  const twilio = { messages: { create: (to: string, body: string) => `twilio:${to}:${body}` } };
  const ses = { sendEmail: (params: { to: string; text: string }) => `ses:${params.to}:${params.text}` };

  const sms = adapt(twilio, { send: (t) => (to: string, text: string) => t.messages.create(to, text) });
  const email = adapt(ses, { send: (s) => (to: string, text: string) => s.sendEmail({ to, text }) });

  for (const channel of [sms, email]) assert.match(channel.send('u1', 'hi'), /u1:hi$/);
});

test('use case: undo in a shopping cart', () => {
  const cart: string[] = [];
  const bus = commandBus();
  const addItem = (sku: string) =>
    bus.run({
      do: () => cart.push(sku),
      undo: () => void cart.splice(cart.lastIndexOf(sku), 1),
    });

  addItem('book');
  addItem('mug');
  bus.undo();
  assert.deepEqual(cart, ['book']);
  bus.redo();
  assert.deepEqual(cart, ['book', 'mug']);
});

test('use case: one business event, several side effects', () => {
  const hub = mediator<{ 'invoice.paid': { id: string; cents: number } }>();
  const effects: string[] = [];

  hub.on('invoice.paid', ({ id }) => effects.push(`email:${id}`));
  hub.on('invoice.paid', ({ cents }) => effects.push(`analytics:${cents}`));
  const offLedger = hub.on('invoice.paid', ({ id }) => effects.push(`ledger:${id}`));

  hub.emit('invoice.paid', { id: 'inv_1', cents: 1999 });
  offLedger(); // one subscriber removed, the publisher never knew it existed
  hub.emit('invoice.paid', { id: 'inv_2', cents: 500 });

  assert.deepEqual(effects, [
    'email:inv_1', 'analytics:1999', 'ledger:inv_1',
    'email:inv_2', 'analytics:500',
  ]);
});

test('use case: six subsystems, and most calls need one', () => {
  const built: string[] = [];
  const checkout = facade(
    {
      payments: () => {
        built.push('payments');
        return { charge: (cents: number) => `charged:${cents}` };
      },
      mail: () => {
        built.push('mail');
        return { send: (to: string) => `sent:${to}` };
      },
      ledger: () => {
        built.push('ledger');
        return { write: (id: string) => `wrote:${id}` };
      },
    },
    (parts) => ({
      pay: (cents: number) => parts.payments.charge(cents),
      receipt: (to: string) => parts.mail.send(to),
    }),
  );

  assert.equal(checkout.pay(1999), 'charged:1999');
  assert.deepEqual(built, ['payments']); // Mailer and Ledger never constructed
});

test('use case: swapping a backend while callers hold the reference', () => {
  type Storage = { put(key: string, value: string): string };
  const s3: Storage = { put: (k, v) => `s3:${k}=${v}` };
  const disk: Storage = { put: (k, v) => `disk:${k}=${v}` };

  const storage = bridge(
    (impl: Storage) => ({ save: (k: string, v: string) => impl.put(k, v) }),
    s3,
  );

  const registered = storage; // captured here, forever
  assert.equal(registered.save('a', '1'), 's3:a=1');
  storage.swap(disk);
  assert.equal(registered.save('a', '1'), 'disk:a=1');
});

test('use case: a driver cursor you want to loop over', () => {
  const cursor = (() => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    let i = 0;
    return { pulled: () => i, hasNext: () => i < rows.length, next: () => rows[i++]! };
  })();

  for (const row of iterate(cursor)) if (row.id === 2) break;
  assert.equal(cursor.pulled(), 2); // stopped pulling at the match

  const fresh = (() => {
    let n = 0;
    return { hasNext: () => n < 100, next: () => n++ };
  })();
  assert.deepEqual([...iterate(fresh)].slice(0, 3), [0, 1, 2]);
});

test('use case: a client rebuilt on every request', () => {
  let pools = 0;
  const stripe = singleton(() => {
    pools += 1;
    return { charges: { create: (cents: number) => `ch_${cents}` } };
  });

  // Four call sites across one request, one connection pool.
  assert.equal(stripe().charges.create(1999), 'ch_1999');
  assert.equal(stripe().charges.create(1), 'ch_1');
  stripe();
  stripe();
  assert.equal(pools, 1);

  // The part people skip: without this, a client cached in a module-level
  // variable leaks from one test into the next.
  stripe.reset();
  stripe();
  assert.equal(pools, 2);
});

test('use case: a query assembled from optional filters', () => {
  type Query = { table: string; user: string; since: string };

  const userId = 'u1';
  const since = undefined as string | undefined;

  // Construction is interruptible: the builder survives being handed to a branch.
  const filters = builder<Query>({ table: 'orders' });
  if (userId) filters.user(userId);
  if (since) filters.since(since);

  assert.deepEqual(filters.build(), { table: 'orders', user: 'u1' });
});

test('use case: an expensive default you keep rebuilding', () => {
  const template = { locale: 'es-MX', sections: ['header'], footer: { page: 1 } };

  const monthly = clone(template);
  monthly.sections.push('summary');
  monthly.footer.page = 2;

  assert.deepEqual(template.sections, ['header'], 'the original is untouched');
  assert.equal(template.footer.page, 1);

  // The trap this avoids: a spread shares the nested arrays.
  const shallow = { ...template };
  shallow.sections.push('oops');
  assert.deepEqual(template.sections, ['header', 'oops'], 'a spread does not protect you');
});

test('use case: thousands of objects that are mostly the same', () => {
  let built = 0;
  const species = flyweight((name: string, texture: string) => {
    built += 1;
    return { name, texture };
  });

  const positions = Array.from({ length: 1000 }, (_, i) => i);
  const trees = positions.map((position) => ({
    position,
    species: species('oak', 'oak.png'),
  }));

  assert.equal(trees.length, 1000);
  assert.equal(built, 1, 'one shared species for a thousand trees');
  assert.equal(trees[0]!.species, trees[999]!.species);

  // Same shape for formatters: expensive to construct, few in number.
  const money = flyweight((locale: string, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }));
  assert.equal(money('es-MX', 'MXN'), money('es-MX', 'MXN'));
});

test('use case: a new operation over a tagged payload', () => {
  type Node =
    | { type: 'charge'; cents: number }
    | { type: 'refund'; cents: number }
    | { type: 'fee'; cents: number };

  const total = visitor<Node, number>({
    charge: (n) => n.cents,
    refund: (n) => -n.cents,
    fee: (n) => -n.cents,
  });

  const describe = visitor<Node, string>({
    charge: (n) => `cobro de ${n.cents}`,
    refund: (n) => `reembolso de ${n.cents}`,
    fee: (n) => `comisión de ${n.cents}`,
  });

  const nodes: Node[] = [
    { type: 'charge', cents: 2000 },
    { type: 'fee', cents: 60 },
    { type: 'refund', cents: 500 },
  ];

  assert.equal(nodes.reduce((sum, node) => sum + total(node), 0), 1440);
  assert.equal(describe(nodes[0]!), 'cobro de 2000');

  // A type nobody handled throws with the tag, instead of a silent default.
  const partial = visitor<Node, number>({ charge: (n) => n.cents });
  assert.throws(() => partial({ type: 'fee', cents: 1 }), /no visitor for "fee"/);
});
