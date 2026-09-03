"""Example 03 — Chain of Responsibility, the painful version.

One endpoint, three providers, one growing if/elif. The final `return` normalises
an unknown provider to zero cents, which is how a payment gets recorded as free and
the webhook still answers 200.

Run it:  PYTHONPATH=packages/py python3 examples/03-chain/before.py
"""


def normalize(event: dict) -> dict:
    if event["source"] == "stripe":
        return {"cents": event.get("data", {}).get("total", 0)}
    elif event["source"] == "spei":
        return {"cents": round(event.get("amount", 0) * 100)}
    elif event["source"] == "oxxo":
        return {"cents": round(event.get("amount", 0) * 100)}
    # Nobody wrote this to be wrong. It was written so the function always returns.
    return {"cents": 0}


stripe = normalize({"source": "stripe", "data": {"total": 1999}})
spei = normalize({"source": "spei", "amount": 19.99})
paypal = normalize({"source": "paypal", "gross": 19.99})

print(f"stripe → {stripe['cents']} centavos")
print(f"spei   → {spei['cents']} centavos")
print(f"paypal → {paypal['cents']} centavos")

assert stripe["cents"] == 1999
assert spei["cents"] == 1999
assert paypal["cents"] == 0  # the bug, asserted on purpose
print("\n⚠️  un proveedor desconocido se registró como un pago de $0.00")
