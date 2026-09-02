"""Video 01 — Singleton, with the pattern.

The diff against before.py is two lines: one import and one `singleton(...)`. The
call sites lose a pair of parentheses. `load_config` itself is untouched.

Run it:  PYTHONPATH=packages/py python3 examples/01-singleton/after.py
"""

import functools
import json

from gof_patterns import singleton

file_on_disk = '{"currency":"MXN","retries":3}'
reads = 0


def load_config() -> dict:
    global reads
    reads += 1
    return json.loads(file_on_disk)


# The whole change. `load_config` decides *what* to load; `singleton` decides *when*.
config = singleton(load_config)


def handle_checkout() -> str:
    return f"charging in {config()['currency']}"


def handle_refund() -> str:
    return f"refunding in {config()['currency']}"


def log_startup() -> str:
    return f"retries = {config()['retries']}"


checkout = handle_checkout()
file_on_disk = '{"currency":"USD","retries":3}'  # the file still changes...
refund = handle_refund()
log_startup()

print(f"config leído del disco: {reads} vez")
print(f"  checkout: {checkout}")
print(f"  refund:   {refund}")
print(f"  las tres llamadas ven el mismo objeto: {config() is config()}")

assert reads == 1, "read once, no matter how many callers"
assert checkout == "charging in MXN"
assert refund == "refunding in MXN"  # ...and now they agree
assert config() is config(), "the same object, so they cannot disagree"

# The part that saves your test suite.
config.reset()
after_reset = config()
assert reads == 2, "reset means the next call builds again"
assert after_reset["currency"] == "USD", "and it picks up the current file"

# What the README tells you to prefer when the function is yours to decorate.
# Same pattern, no dependency — and this is the honest version of the video.
reads_stdlib = 0


@functools.cache
def config_stdlib() -> dict:
    global reads_stdlib
    reads_stdlib += 1
    return json.loads(file_on_disk)


assert config_stdlib() is config_stdlib()
assert reads_stdlib == 1
config_stdlib.cache_clear()  # this is `reset`
config_stdlib()
assert reads_stdlib == 2

print("\n✅ una lectura, una sola verdad, y reset() para los tests")
print("   (y con functools.cache es lo mismo si la función es tuya)")
