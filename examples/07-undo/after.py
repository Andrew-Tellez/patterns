"""Example 07 — Command and Memento, with the pattern.

Two right answers, and picking wrong is what hurts later:

  CommandBus — you can describe the inverse of each action. Cheap, and it does not
               care how large the document is.
  History    — you cannot, so you keep whole snapshots. Always correct, and memory
               grows with state size times history depth.

Run it:  PYTHONPATH=packages/py python3 examples/07-undo/after.py
"""

import copy as copy_module

from gof_patterns import CommandBus, Do, History

# --- Command: the inverse of "append a line" is "remove the last line" -------
doc = {"lines": [f"línea {i}" for i in range(500)]}
bus = CommandBus()


def edit(line: str):
    return bus.run(Do(lambda: doc["lines"].append(line), undo=doc["lines"].pop))


edit("a")
edit("b")
edit("c")

print(f"líneas: {len(doc['lines'])}")
bus.undo()
bus.undo()
print(f"tras dos undo: {len(doc['lines'])}")
bus.redo()
print(f"tras un redo: {len(doc['lines'])}")

assert len(doc["lines"]) == 502
assert bus.can_redo
print("  ningún byte del documento fue copiado — solo dos lambdas por edición")

# --- Memento: for state whose inverse you cannot describe --------------------
# Sorting is the classic case: "unsort" is not an operation, so the only way back
# is a copy of what it looked like before.
filters = History({"sort": "date", "tags": []}, limit=50, snapshot=copy_module.deepcopy)
filters.save({"sort": "amount", "tags": ["paid"]})
filters.save({"sort": "amount", "tags": ["paid", "mxn"]})

assert filters.undo() == {"sort": "amount", "tags": ["paid"]}
assert filters.redo() == {"sort": "amount", "tags": ["paid", "mxn"]}

# `snapshot` is not optional decoration. Without it the history holds references,
# so mutating the live object rewrites the past.
live = {"sort": "date", "tags": ["a"]}
careless = History(live)
careless.save(live)
live["tags"].append("mutated")
assert careless.undo()["tags"] == ["a", "mutated"], "the past was rewritten"

careful = History(live, snapshot=copy_module.deepcopy)
careful.save(live)
live["tags"].append("again")
assert careful.undo()["tags"] == ["a", "mutated"], "the snapshot held"

print("\n✅ Command para lo invertible, History para lo que no — y snapshot no es opcional")
