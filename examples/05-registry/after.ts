/**
 * Example 05 — Factory Method / Strategy, with the pattern.
 *
 * Registration lives next to each implementation, so a new rail is a new file and
 * one `register` call. The switch never gets reopened, and an unknown key throws
 * with the key in the message.
 *
 * Run it:  node examples/05-registry/after.ts
 */
import assert from 'node:assert/strict';
import { registry } from '../../packages/ts/src/index.ts';

type Rail = { send(cents: number): string };

const rails = registry<{
  stripe: () => Rail;
  spei: (clabe: string) => Rail;
  paypal: () => Rail;
}>();

// Each of these lines would live in the file that implements that rail.
rails.register('stripe', () => ({ send: (cents) => `stripe:${cents}` }));
rails.register('spei', (clabe) => ({ send: (cents) => `spei:${clabe}:${cents}` }));

const results = [rails.create('stripe').send(1999), rails.create('spei', '0123').send(1999)];
results.forEach((result) => console.log(`  ${result}`));

let refused = '';
try {
  rails.create('paypal');
} catch (error) {
  refused = (error as Error).message;
}
console.log(`  desconocido → ${refused}`);

assert.deepEqual(results, ['stripe:1999', 'spei:0123:1999']);
assert.match(refused, /nothing registered for "paypal"/);

// The rail that arrived later: a new file, one line, nothing else edited.
rails.register('paypal', () => ({ send: (cents) => `paypal:${cents}` }));
assert.equal(rails.create('paypal').send(1999), 'paypal:1999');
assert.deepEqual(rails.keys().sort(), ['paypal', 'spei', 'stripe']);

console.log('\n✅ un riel nuevo es un archivo nuevo, y lo desconocido truena con la clave');
