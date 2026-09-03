/**
 * Video 06 — Observer / Mediator, the painful version.
 *
 * The function that charges the card also emails, tracks, writes the ledger and
 * refreshes a cache. It imports all five, so a unit test of "charge" needs all
 * five, and adding a sixth means editing the payment code again.
 *
 * Run it:  node examples/06-observer/before.ts
 */
import assert from 'node:assert/strict';

const effects: string[] = [];

const mailer = { send: (id: string) => effects.push(`email:${id}`) };
const analytics = { track: (cents: number) => effects.push(`analytics:${cents}`) };
const ledger = { write: (id: string) => effects.push(`ledger:${id}`) };
const crm = { notify: (id: string) => effects.push(`crm:${id}`) };

function payInvoice(id: string, cents: number): string {
  const charge = `ch_${cents}`;

  // Four imports the payment logic did not need, and a fifth on the way.
  mailer.send(id);
  analytics.track(cents);
  ledger.write(id);
  crm.notify(id);

  return charge;
}

const charge = payInvoice('inv_1', 1999);
console.log(`cobro: ${charge}`);
console.log(`efectos: ${effects.join(', ')}`);

assert.equal(charge, 'ch_1999');
assert.equal(effects.length, 4);
console.log('\n⚠️  para probar "cobrar" hay que cargar mailer, analytics, ledger y crm');
