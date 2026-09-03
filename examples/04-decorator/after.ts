/**
 * Example 04 — Decorator, with the pattern.
 *
 * Each concern is its own wrapper, and the composition line says what order they
 * run in. Swap the arguments and the original bug comes back — which is the point:
 * the order is now a visible decision instead of an accident in a loop.
 *
 * Run it:  node examples/04-decorator/after.ts
 */
import assert from 'node:assert/strict';
import { decorate } from '../../packages/ts/src/index.ts';

type Charge = (cents: number) => Promise<string>;

const log: string[] = [];
let attempts = 0;

const rawCharge: Charge = async (cents) => {
  attempts += 1;
  if (attempts < 3) throw new Error('502 from provider');
  return `ch_${cents}`;
};

const withLog = (next: Charge): Charge => async (cents) => {
  log.push(`charging ${cents}`);
  return next(cents);
};

// withRetry knows nothing about payments: it works on anything of this shape.
const withRetry = (times: number) => (next: Charge): Charge => async (cents) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await next(cents);
    } catch (error) {
      if (attempt >= times) throw error;
    }
  }
};

// Reads in the order it runs: log first, then retries, then the real call.
const charge = decorate(rawCharge, withLog, withRetry(3));

const result = await charge(1999);
console.log(`resultado: ${result}`);
console.log(`intentos:  ${attempts}`);
console.log(`log:       ${log.length} línea → ${log[0]}`);

assert.equal(result, 'ch_1999');
assert.equal(attempts, 3, 'still retried three times');
assert.equal(log.length, 1, 'but logged once');

// Swap the two wrappers and the original bug is back — on purpose. This is the
// part that makes the pattern click.
attempts = 0;
const noisyLog: string[] = [];
const noisyWithLog = (next: Charge): Charge => async (cents) => {
  noisyLog.push(`charging ${cents}`);
  return next(cents);
};
const noisy = decorate(rawCharge, withRetry(3), noisyWithLog);
await noisy(1999);
console.log(`al invertir el orden: ${noisyLog.length} líneas de log`);
assert.equal(noisyLog.length, 3, 'order is a decision, and now a visible one');

// The real payoff: the same layers on another function, with no new code.
attempts = 0;
const rawRefund: Charge = async (cents) => `rf_${cents}`;
const refund = decorate(rawRefund, withLog, withRetry(3));
assert.equal(await refund(500), 'rf_500');
assert.equal(log.length, 2, 'both functions share one retry policy');

console.log('\n✅ un log por llamada, el orden explícito, y las mismas capas reutilizadas');
