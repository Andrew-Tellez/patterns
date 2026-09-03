"""Video 05 — Factory Method / Strategy, the painful version.

One if/elif that every new payment rail has to reopen, and a fallthrough that turns
an unknown rail into a silent success.

Run it:  PYTHONPATH=packages/py python3 examples/05-registry/before.py
"""


def rail_for(name: str, clabe: str | None = None):
    if name == "stripe":
        return lambda cents: f"stripe:{cents}"
    elif name == "spei":
        return lambda cents: f"spei:{clabe}:{cents}"
    # Written so the function always returns something.
    return lambda cents: "noop"


results = [
    rail_for("stripe")(1999),
    rail_for("spei", "0123")(1999),
    rail_for("paypal")(1999),
]

for result in results:
    print(f"  {result}")

assert results == ["stripe:1999", "spei:0123:1999", "noop"]
print("\n⚠️  un riel desconocido \"cobró\" y devolvió noop — el pago se perdió en silencio")
