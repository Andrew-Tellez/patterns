/**
 * Example 07 — Command and Memento, with the pattern.
 *
 * Two right answers, and picking wrong is what hurts later:
 *
 *   commandBus — you can describe the inverse of each action. Cheap, and it does
 *                not care how large the document is.
 *   history    — you cannot, so you keep whole snapshots. Always correct, and
 *                memory grows with state size times history depth.
 *
 * Run it:  node examples/07-undo/after.ts
 */
import assert from 'node:assert/strict';
import { commandBus, history } from '../../packages/ts/src/index.ts';

// --- Command: the inverse of "append a line" is "remove the last line" ------
const doc = { lines: Array.from({ length: 500 }, (_, i) => `línea ${i}`) };
const bus = commandBus();

const edit = (line: string) =>
  bus.run({
    do: () => doc.lines.push(line),
    undo: () => void doc.lines.pop(),
  });

edit('a');
edit('b');
edit('c');

console.log(`líneas: ${doc.lines.length}`);
bus.undo();
bus.undo();
console.log(`tras dos undo: ${doc.lines.length}`);
bus.redo();
console.log(`tras un redo: ${doc.lines.length}`);

assert.equal(doc.lines.length, 502);
assert.equal(bus.canRedo(), true);
console.log('  ningún byte del documento fue copiado — solo dos closures por edición');

// --- Memento: for state whose inverse you cannot describe -------------------
// Sorting is the classic case: "unsort" is not an operation, so the only way back
// is a copy of what it looked like before.
type Filters = { sort: 'date' | 'amount'; tags: string[] };

const filters = history<Filters>(
  { sort: 'date', tags: [] },
  { limit: 50, snapshot: structuredClone },
);

filters.save({ sort: 'amount', tags: ['paid'] });
filters.save({ sort: 'amount', tags: ['paid', 'mxn'] });

assert.deepEqual(filters.undo(), { sort: 'amount', tags: ['paid'] });
assert.deepEqual(filters.redo(), { sort: 'amount', tags: ['paid', 'mxn'] });

// The `snapshot` is not optional decoration. Without it the history holds
// references, so mutating the live object rewrites the past.
const live = { sort: 'date' as const, tags: ['a'] };
const careless = history(live);
careless.save(live);
live.tags.push('mutated');
assert.deepEqual(careless.undo()?.tags, ['a', 'mutated'], 'the past was rewritten');

const careful = history(live, { snapshot: structuredClone });
careful.save(live);
live.tags.push('again');
assert.deepEqual(careful.undo()?.tags, ['a', 'mutated'], 'the snapshot held');

console.log('\n✅ Command para lo invertible, history para lo que no — y snapshot no es opcional');
