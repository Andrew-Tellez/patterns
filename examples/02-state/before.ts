/**
 * Video 02 — State, the painful version.
 *
 * Three independent booleans give eight combinations, of which only four are legal
 * orders. This file walks straight into two of the illegal ones, and nothing
 * complains.
 *
 * Run it:  node examples/02-state/before.ts
 */
import assert from 'node:assert/strict';

type Order = { isPaid: boolean; isShipped: boolean; isRefunded: boolean };

const order: Order = { isPaid: false, isShipped: false, isRefunded: false };
const events: string[] = [];

function pay(o: Order): void {
  if (o.isPaid) return;
  o.isPaid = true;
  events.push('paid');
}

function ship(o: Order): void {
  // The rule that matters — "you cannot ship what nobody paid" — lives here, in
  // this caller, and it is not written down anywhere else.
  if (o.isShipped) return;
  o.isShipped = true;
  events.push('shipped');
}

function refund(o: Order): void {
  // This one forgot to check isRefunded. It is a one-line omission and it is the
  // most common bug in this shape of code.
  o.isRefunded = true;
  events.push('refunded');
}

ship(order); // nobody paid
refund(order);
refund(order); // and again

console.log(`estado: ${JSON.stringify(order)}`);
console.log(`eventos: ${events.join(', ')}`);

assert.equal(order.isShipped, true);
assert.equal(order.isPaid, false);
assert.equal(events.filter((e) => e === 'refunded').length, 2);
console.log('\n⚠️  enviada sin pagar, y reembolsada dos veces — sin un solo error');
