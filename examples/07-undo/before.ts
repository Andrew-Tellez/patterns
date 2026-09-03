/**
 * Example 07 — Command and Memento, the painful version.
 *
 * A feature request for undo arrives, and the first attempt keeps a copy of the
 * whole document on every keystroke. It works, and then someone pastes a 2 MB
 * document and the tab dies.
 *
 * Run it:  node examples/07-undo/before.ts
 */
import assert from 'node:assert/strict';

type Doc = { lines: string[]; cursor: number };

const doc: Doc = { lines: [], cursor: 0 };
const snapshots: Doc[] = [];
let bytesKept = 0;

function edit(line: string): void {
  // A full copy per edit. Correct, and the memory grows with document size times
  // history depth.
  const copy: Doc = { lines: [...doc.lines], cursor: doc.cursor };
  snapshots.push(copy);
  bytesKept += JSON.stringify(copy).length;

  doc.lines.push(line);
  doc.cursor += 1;
}

function undo(): void {
  const previous = snapshots.pop();
  if (!previous) return;
  doc.lines = previous.lines;
  doc.cursor = previous.cursor;
}

// A realistic document: 500 lines already there before the user types anything.
doc.lines.push(...Array.from({ length: 500 }, (_, i) => `línea ${i}`));

edit('a');
edit('b');
edit('c');

console.log(`líneas: ${doc.lines.length}`);
console.log(`snapshots: ${snapshots.length}`);
console.log(`bytes copiados: ${bytesKept}`);

undo();
assert.equal(doc.lines.length, 502);
assert.equal(snapshots.length, 2);

// The claim, stated exactly rather than as a round number: what was copied is
// three whole documents, give or take the three lines that were being added.
const oneCopy = JSON.stringify({ lines: doc.lines.slice(0, 500), cursor: 0 }).length;
assert.ok(
  bytesKept > 2.9 * oneCopy && bytesKept < 3.1 * oneCopy,
  `expected ~3 copies of ${oneCopy} bytes, kept ${bytesKept}`,
);
console.log(
  `\n⚠️  tres teclas copiaron el documento completo tres veces` +
    ` (${bytesKept} bytes ≈ 3 × ${oneCopy})`,
);
