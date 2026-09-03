/**
 * Example 04 — Decorator, the painful version.
 *
 * Retry and logging are tangled in the same loop, the loop is copy-pasted, and the
 * two copies have already drifted. One charge produces three log lines, which reads
 * as three charge attempts on a dashboard.
 *
 * Run it:  node examples/04-decorator/before.ts
 */
import assert from 'node:assert/strict';

const log: string[] = [];
let attempts = 0;

async function rawCharge(cents: number): Promise<string> {
  attempts += 1;
  if (attempts < 3) throw new Error('502 from provider');
  return `ch_${cents}`;
}

async function charge(cents: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    // The log line lives inside the loop because that is where it was written,
    // not because anyone decided it belonged there.
    log.push(`charging ${cents}`);
    try {
      return await rawCharge(cents);
    } catch (error) {
      if (attempt >= 3) throw error;
    }
  }
}

async function refund(cents: number): Promise<string> {
  // The same loop, copied — and it already drifted to 2 retries. Nobody chose that.
  for (let attempt = 0; ; attempt++) {
    log.push(`refunding ${cents}`);
    try {
      return await rawCharge(cents);
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }
}

const result = await charge(1999);

console.log(`resultado: ${result}`);
console.log(`intentos:  ${attempts}`);
console.log(`log (${log.length} líneas):`);
log.forEach((line) => console.log(`  ${line}`));

assert.equal(result, 'ch_1999');
assert.equal(attempts, 3);
assert.equal(log.length, 3, 'one charge, three log lines');
void refund;
console.log('\n⚠️  un cobro, tres líneas de log — parece tres cobros en el dashboard');
