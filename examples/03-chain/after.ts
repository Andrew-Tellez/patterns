/**
 * Example 03 — Chain of Responsibility, with the pattern.
 *
 * One handler per provider, and the `else` that returned zero becomes an explicit
 * fallback that throws. Adding a provider is a new function and one array entry —
 * the function that already worked is never reopened.
 *
 * Run it:  node examples/03-chain/after.ts
 */
import assert from 'node:assert/strict';
import { chain } from '../../packages/ts/src/index.ts';

type Incoming = {
  source: string;
  amount?: number;
  gross?: number;
  data?: { total?: number };
};
type Amount = { cents: number };

const fromStripe = (e: Incoming, next: () => Amount): Amount =>
  e.source === 'stripe' ? { cents: e.data?.total ?? 0 } : next();

const fromSpei = (e: Incoming, next: () => Amount): Amount =>
  e.source === 'spei' ? { cents: Math.round((e.amount ?? 0) * 100) } : next();

// The provider that arrived after the original code was written. A new function,
// and one entry below — nothing else moves.
const fromPaypal = (e: Incoming, next: () => Amount): Amount =>
  e.source === 'paypal' ? { cents: Math.round((e.gross ?? 0) * 100) } : next();

const normalize = chain<Incoming, Amount>([fromStripe, fromSpei, fromPaypal], (e) => {
  // The decision that used to hide in a `return { cents: 0 }`, now an argument.
  throw new Error(`unknown source: ${e.source}`);
});

console.log(`stripe → ${normalize({ source: 'stripe', data: { total: 1999 } }).cents} centavos`);
console.log(`spei   → ${normalize({ source: 'spei', amount: 19.99 }).cents} centavos`);
console.log(`paypal → ${normalize({ source: 'paypal', gross: 19.99 }).cents} centavos`);

let refused = '';
try {
  normalize({ source: 'bitcoin' });
} catch (error) {
  refused = (error as Error).message;
}
console.log(`desconocido → ${refused}`);

assert.equal(normalize({ source: 'paypal', gross: 19.99 }).cents, 1999);
assert.equal(refused, 'unknown source: bitcoin');

// Same helper for async, because Res can be a promise. No separate "async" version.
const lookup = chain<string, Promise<string>>(
  [
    async (id, next) => (id === 'cache' ? 'from-cache' : next()),
    async (id, next) => (id === 'db' ? 'from-db' : next()),
  ],
  async () => 'not-found',
);

assert.equal(await lookup('db'), 'from-db');
assert.equal(await lookup('zzz'), 'not-found');
console.log('\n✅ un proveedor nuevo es una función más, y lo desconocido truena');
