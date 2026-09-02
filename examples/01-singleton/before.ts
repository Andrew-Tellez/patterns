/**
 * Video 01 — Singleton, the painful version.
 *
 * Nobody did anything wrong here. Three unrelated pieces of code each ask for the
 * configuration, so the file is read and parsed three times — and if it changes in
 * between, they end up disagreeing inside one request.
 *
 * Run it:  node examples/01-singleton/before.ts
 */
import assert from 'node:assert/strict';

// Stands in for the file on disk, so the example needs no fixtures.
let fileOnDisk = '{"currency":"MXN","retries":3}';
let reads = 0;

type Config = { currency: string; retries: number };

function loadConfig(): Config {
  reads += 1;
  return JSON.parse(fileOnDisk) as Config;
}

function handleCheckout(): string {
  const config = loadConfig();
  return `charging in ${config.currency}`;
}

function handleRefund(): string {
  const config = loadConfig();
  return `refunding in ${config.currency}`;
}

function logStartup(): string {
  return `retries = ${loadConfig().retries}`;
}

const checkout = handleCheckout();

// A deploy, a feature flag, someone editing the ConfigMap — the file changes while
// the request is still in flight.
fileOnDisk = '{"currency":"USD","retries":3}';

const refund = handleRefund();
logStartup();

console.log(`config leído del disco: ${reads} veces`);
console.log(`  checkout: ${checkout}`);
console.log(`  refund:   ${refund}`);

// The example asserts the bug on purpose: this is what you are about to fix.
assert.equal(reads, 3, 'the file is parsed once per caller');
assert.equal(checkout, 'charging in MXN');
assert.equal(refund, 'refunding in USD'); // same request, different currency
console.log('\n⚠️  dos partes del mismo request vieron monedas distintas');
