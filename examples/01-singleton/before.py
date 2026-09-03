"""Example 01 — Singleton, the painful version.

Nobody did anything wrong here. Three unrelated pieces of code each ask for the
configuration, so the file is read and parsed three times — and if it changes in
between, they end up disagreeing inside one request.

Run it:  PYTHONPATH=packages/py python3 examples/01-singleton/before.py
"""

import json

# Stands in for the file on disk, so the example needs no fixtures.
file_on_disk = '{"currency":"MXN","retries":3}'
reads = 0


def load_config() -> dict:
    global reads
    reads += 1
    return json.loads(file_on_disk)


def handle_checkout() -> str:
    return f"charging in {load_config()['currency']}"


def handle_refund() -> str:
    return f"refunding in {load_config()['currency']}"


def log_startup() -> str:
    return f"retries = {load_config()['retries']}"


checkout = handle_checkout()

# A deploy, a feature flag, someone editing the ConfigMap — the file changes while
# the request is still in flight.
file_on_disk = '{"currency":"USD","retries":3}'

refund = handle_refund()
log_startup()

print(f"config leído del disco: {reads} veces")
print(f"  checkout: {checkout}")
print(f"  refund:   {refund}")

# The example asserts the bug on purpose: this is the problem the pattern solves.
assert reads == 3, "the file is parsed once per caller"
assert checkout == "charging in MXN"
assert refund == "refunding in USD"  # same request, different currency
print("\n⚠️  dos partes del mismo request vieron monedas distintas")
