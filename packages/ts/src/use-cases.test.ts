/**
 * The code in USE-CASES.md, run as tests. If a scenario in that document stops
 * working, this file fails — the examples are a tested claim, not prose.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { adapt, chain, commandBus, decorate, mediator, registry, stateMachine } from './index.ts';

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
