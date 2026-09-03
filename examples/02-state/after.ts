/**
 * Example 02 — State, with the pattern.
 *
 * The transition table *is* the business rule: one place, readable by someone who
 * has never seen the code. Illegal transitions throw, naming the event and the
 * state that refused it.
 *
 * Run it:  node examples/02-state/after.ts
 */
import assert from 'node:assert/strict';
import { stateMachine } from '../../packages/ts/src/index.ts';

const order = stateMachine<'draft' | 'paid' | 'shipped' | 'refunded', 'pay' | 'ship' | 'refund'>({
  initial: 'draft',
  states: {
    draft: { pay: 'paid' },
    paid: { ship: 'shipped', refund: 'refunded' },
    shipped: { refund: 'refunded' },
    refunded: {}, // final: an empty entry says so
  },
});

// The audit trail comes free, because every transition now goes through one place.
const audit: string[] = [];
order.onChange(({ from, to, event }) => audit.push(`${event}: ${from} -> ${to}`));

// Shipping before paying is now impossible, and it says so.
let refused = '';
try {
  order.send('ship');
} catch (error) {
  refused = (error as Error).message;
}
console.log(`rechazado: ${refused}`);

order.send('pay');
order.send('ship');
order.send('refund');

console.log(`estado: ${order.state()}`);
console.log(`audit:\n  ${audit.join('\n  ')}`);
console.log(`¿se puede reembolsar otra vez? ${order.can('refund')}`);

assert.match(refused, /"ship" is not allowed in "draft"/);
assert.equal(order.state(), 'refunded');
assert.equal(order.can('refund'), false, 'refunded is final, so nothing is allowed');
assert.deepEqual(audit, [
  'pay: draft -> paid',
  'ship: paid -> shipped',
  'refund: shipped -> refunded',
]);
console.log('\n✅ los estados imposibles ya no compilan, y los ilegales truenan al intentarlos');
