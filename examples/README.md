# Examples — one runnable problem per pattern

Each folder is a video's worth of material for one pattern:

| File | What it is |
| --- | --- |
| `SCRIPT.md` | The narration, with the code broken into the steps you type on screen |
| `before.ts` / `before.py` | The painful version. It runs, and it demonstrates the bug |
| `after.ts` / `after.py` | The same thing with the pattern. It runs, and the bug is gone |

**Every file is executable and asserts its own result**, and CI runs all of them — so an
example cannot quietly stop working. `before` files assert the *wrong* behaviour on purpose:
that is the problem you are about to solve on camera.

The narration is in Spanish because that is the audience; the code and its comments are in
English, like the rest of the repository.

## Running them

```bash
# TypeScript — needs Node 22.18+ for the built-in type stripping
node examples/01-singleton/before.ts
node examples/01-singleton/after.ts

# Python
PYTHONPATH=packages/py python3 examples/01-singleton/before.py
PYTHONPATH=packages/py python3 examples/01-singleton/after.py
```

Or all of them at once, the way CI does:

```bash
./examples/run-all.sh
```

## The examples

| # | Pattern | The problem it opens with |
| --- | --- | --- |
| 01 | Singleton | Config parsed from disk on every call, and two callers seeing different config |
| 02 | State | An order with three booleans, so it can ship without being paid |
| 03 | Chain of Responsibility | One webhook endpoint, three providers, and a fourth on the way |
| 04 | Decorator | Retry and logging copied into every call site, logging once per attempt |
