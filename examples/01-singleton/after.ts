/**
 * Video 01 — Singleton, with the pattern.
 *
 * The diff against before.ts is four lines: one import, one `singleton(...)`, and
 * the call sites losing three characters each. `loadConfig` itself is untouched, so
 * it stays testable on its own.
 *
 * Run it:  node examples/01-singleton/after.ts
 */
import assert from 'node:assert/strict';
import { singleton } from '../../packages/ts/src/index.ts';

let fileOnDisk = '{"currency":"MXN","retries":3}';
let reads = 0;

type Config = { currency: string; retries: number };

function loadConfig(): Config {
  reads += 1;
  return JSON.parse(fileOnDisk) as Config;
}

// The whole change. `loadConfig` decides *what* to load; `singleton` decides *when*.
const config = singleton(loadConfig);

function handleCheckout(): string {
  return `charging in ${config().currency}`;
}

function handleRefund(): string {
  return `refunding in ${config().currency}`;
}

function logStartup(): string {
  return `retries = ${config().retries}`;
}

const checkout = handleCheckout();
fileOnDisk = '{"currency":"USD","retries":3}'; // the file still changes...
const refund = handleRefund();
logStartup();

console.log(`config leído del disco: ${reads} vez`);
console.log(`  checkout: ${checkout}`);
console.log(`  refund:   ${refund}`);
console.log(`  las tres llamadas ven el mismo objeto: ${config() === config()}`);

assert.equal(reads, 1, 'read once, no matter how many callers');
assert.equal(checkout, 'charging in MXN');
assert.equal(refund, 'refunding in MXN'); // ...and now they agree
assert.equal(config(), config(), 'the same object, so they cannot disagree');

// The part that saves your test suite. A hand-rolled singleton in a module-level
// variable leaks state from one test into the next; this drops it.
config.reset();
const afterReset = config();
assert.equal(reads, 2, 'reset means the next call builds again');
assert.equal(afterReset.currency, 'USD', 'and it picks up the current file');
console.log('\n✅ una lectura, una sola verdad, y reset() para los tests');
