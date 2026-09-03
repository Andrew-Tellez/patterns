"""Example 07 — Command and Memento, the painful version.

A feature request for undo arrives, and the first attempt keeps a copy of the whole
document on every keystroke. It works, and then someone pastes a large document.

Run it:  PYTHONPATH=packages/py python3 examples/07-undo/before.py
"""

import json

doc = {"lines": [f"línea {i}" for i in range(500)], "cursor": 0}
snapshots: list[dict] = []
bytes_kept = 0


def edit(line: str) -> None:
    global bytes_kept
    # A full copy per edit. Correct, and memory grows with document size times
    # history depth.
    copy = {"lines": list(doc["lines"]), "cursor": doc["cursor"]}
    snapshots.append(copy)
    bytes_kept += len(json.dumps(copy))

    doc["lines"].append(line)
    doc["cursor"] += 1


def undo() -> None:
    if not snapshots:
        return
    previous = snapshots.pop()
    doc["lines"] = previous["lines"]
    doc["cursor"] = previous["cursor"]


edit("a")
edit("b")
edit("c")

print(f"líneas: {len(doc['lines'])}")
print(f"snapshots: {len(snapshots)}")
print(f"bytes copiados: {bytes_kept}")

undo()
assert len(doc["lines"]) == 502
assert len(snapshots) == 2

one_copy = len(json.dumps({"lines": doc["lines"][:500], "cursor": 0}))
assert 2.9 * one_copy < bytes_kept < 3.1 * one_copy, f"~3 copias de {one_copy}, guardó {bytes_kept}"
print(
    f"\n⚠️  tres teclas copiaron el documento completo tres veces"
    f" ({bytes_kept} bytes ≈ 3 × {one_copy})"
)
