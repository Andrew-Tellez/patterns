"""Example 03 — Chain of Responsibility, with the pattern.

One handler per provider, and the fallthrough that returned zero becomes an
explicit fallback that raises. Adding a provider is a new function and one list
entry — the function that already worked is never reopened.

Note the parameter name: `next_`, because `next` is a builtin.

Run it:  PYTHONPATH=packages/py python3 examples/03-chain/after.py
"""

from gof_patterns import chain


def from_stripe(event: dict, next_):
    if event["source"] == "stripe":
        return {"cents": event.get("data", {}).get("total", 0)}
    return next_()


def from_spei(event: dict, next_):
    if event["source"] == "spei":
        return {"cents": round(event.get("amount", 0) * 100)}
    return next_()


# The provider that arrived after the original code was written.
def from_paypal(event: dict, next_):
    if event["source"] == "paypal":
        return {"cents": round(event.get("gross", 0) * 100)}
    return next_()


def unknown(event: dict):
    # The decision that used to hide in a `return {"cents": 0}`, now an argument.
    raise ValueError(f"unknown source: {event['source']}")


normalize = chain([from_stripe, from_spei, from_paypal], fallback=unknown)

print(f"stripe → {normalize({'source': 'stripe', 'data': {'total': 1999}})['cents']} centavos")
print(f"spei   → {normalize({'source': 'spei', 'amount': 19.99})['cents']} centavos")
print(f"paypal → {normalize({'source': 'paypal', 'gross': 19.99})['cents']} centavos")

refused = ""
try:
    normalize({"source": "bitcoin"})
except ValueError as error:
    refused = str(error)
print(f"desconocido → {refused}")

assert normalize({"source": "paypal", "gross": 19.99})["cents"] == 1999
assert refused == "unknown source: bitcoin"
print("\n✅ un proveedor nuevo es una función más, y lo desconocido truena")
