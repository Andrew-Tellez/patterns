/**
 * Video 03 — Chain of Responsibility, the painful version.
 *
 * One endpoint, three providers, one growing if/else. The `else` at the bottom
 * normalises an unknown provider to zero cents, which is how a payment gets
 * recorded as free and the webhook still answers 200.
 *
 * Run it:  node examples/03-chain/before.ts
 */
import assert from 'node:assert/strict';

type Incoming = {
  source: string;
  amount?: number;
  gross?: number;
  data?: { total?: number };
};

function normalize(event: Incoming): { cents: number } {
  if (event.source === 'stripe') {
    return { cents: event.data?.total ?? 0 };
  } else if (event.source === 'spei') {
    return { cents: Math.round((event.amount ?? 0) * 100) };
  } else if (event.source === 'oxxo') {
    return { cents: Math.round((event.amount ?? 0) * 100) };
  }
  // Nobody wrote this to be wrong. It was written to satisfy the return type.
  return { cents: 0 };
}

const stripe = normalize({ source: 'stripe', data: { total: 1999 } });
const spei = normalize({ source: 'spei', amount: 19.99 });
const paypal = normalize({ source: 'paypal', gross: 19.99 });

console.log(`stripe → ${stripe.cents} centavos`);
console.log(`spei   → ${spei.cents} centavos`);
console.log(`paypal → ${paypal.cents} centavos`);

assert.equal(stripe.cents, 1999);
assert.equal(spei.cents, 1999);
assert.equal(paypal.cents, 0); // the bug, asserted on purpose
console.log('\n⚠️  un proveedor desconocido se registró como un pago de $0.00');
