/**
 * Video 05 — Factory Method / Strategy, the painful version.
 *
 * One switch that every new payment rail has to reopen. Three teams touch this
 * function, and the default branch is what turns an unknown rail into a silent
 * success.
 *
 * Run it:  node examples/05-registry/before.ts
 */
import assert from 'node:assert/strict';

type Rail = { send(cents: number): string };

function railFor(name: string, clabe?: string): Rail {
  // Every rail is imported at the top of this file whether the request needs it
  // or not, and adding one means editing a function that already works.
  switch (name) {
    case 'stripe':
      return { send: (cents) => `stripe:${cents}` };
    case 'spei':
      return { send: (cents) => `spei:${clabe}:${cents}` };
    default:
      // Written so the function always returns something.
      return { send: () => 'noop' };
  }
}

const results = [
  railFor('stripe').send(1999),
  railFor('spei', '0123').send(1999),
  railFor('paypal').send(1999),
];

results.forEach((result) => console.log(`  ${result}`));

assert.deepEqual(results, ['stripe:1999', 'spei:0123:1999', 'noop']);
console.log('\n⚠️  un riel desconocido "cobró" y devolvió noop — el pago se perdió en silencio');
