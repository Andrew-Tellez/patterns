/**
 * Video 06 — Observer / Mediator, with the pattern.
 *
 * `payInvoice` announces what happened and knows nothing about who cares. The
 * subscriptions live where the effects live, and a unit test of the payment path
 * subscribes nobody.
 *
 * Run it:  node examples/06-observer/after.ts
 */
import assert from 'node:assert/strict';
import { mediator } from '../../packages/ts/src/index.ts';

const hub = mediator<{ 'invoice.paid': { id: string; cents: number } }>();
const effects: string[] = [];

// Each of these lines would live in the module that owns that effect.
hub.on('invoice.paid', ({ id }) => effects.push(`email:${id}`));
hub.on('invoice.paid', ({ cents }) => effects.push(`analytics:${cents}`));
const offLedger = hub.on('invoice.paid', ({ id }) => effects.push(`ledger:${id}`));

function payInvoice(id: string, cents: number): string {
  const charge = `ch_${cents}`;
  hub.emit('invoice.paid', { id, cents }); // that is the whole coupling
  return charge;
}

const charge = payInvoice('inv_1', 1999);
console.log(`cobro: ${charge}`);
console.log(`efectos: ${effects.join(', ')}`);

offLedger(); // the ledger goes away and the publisher never knew it existed
payInvoice('inv_2', 500);
console.log(`después de quitar el ledger: ${effects.slice(3).join(', ')}`);

assert.equal(charge, 'ch_1999');
assert.deepEqual(effects, [
  'email:inv_1',
  'analytics:1999',
  'ledger:inv_1',
  'email:inv_2',
  'analytics:500',
]);

// The event name is typed, so a typo is a compile error rather than a handler that
// silently never fires — the failure mode of every hand-rolled event bus.
//
// This line is the proof, and it is checked by `tsc`, not at runtime: if
// 'invoice.pied' ever became a valid channel, the build would fail because the
// directive below would be unused. A runtime assertion could not test this at
// all — emitting an unknown channel does not throw, it just creates a channel
// nobody listens to.
//
// (A comment line must never *begin* with that directive's text, or TypeScript
// reads the prose itself as a directive pointing at the next comment. Which is
// how this example first failed its own typecheck.)
// @ts-expect-error 'invoice.pied' is not a channel of this mediator
hub.on('invoice.pied', () => {});

console.log('\n✅ el cobro anuncia y ya; los efectos viven donde viven, y el nombre es tipado');
