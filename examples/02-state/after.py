"""Example 02 — State, with the pattern.

The transition table *is* the business rule: one place, readable by someone who has
never seen the code. Illegal transitions raise, naming the event and the state that
refused it.

Run it:  PYTHONPATH=packages/py python3 examples/02-state/after.py
"""

from gof_patterns import StateMachine

order = StateMachine(
    "draft",
    {
        "draft": {"pay": "paid"},
        "paid": {"ship": "shipped", "refund": "refunded"},
        "shipped": {"refund": "refunded"},
        "refunded": {},  # final: an empty entry says so
    },
)

# The audit trail comes free, because every transition now goes through one place.
audit: list[str] = []
order.changes.subscribe(lambda change: audit.append(f"{change[2]}: {change[0]} -> {change[1]}"))

# Shipping before paying is now impossible, and it says so.
refused = ""
try:
    order.send("ship")
except ValueError as error:
    refused = str(error)
print(f"rechazado: {refused}")

order.send("pay")
order.send("ship")
order.send("refund")

print(f"estado: {order.state}")
print("audit:\n  " + "\n  ".join(audit))
print(f"¿se puede reembolsar otra vez? {order.can('refund')}")

assert "'ship' is not allowed in 'draft'" in refused
assert order.state == "refunded"
assert not order.can("refund"), "refunded is final, so nothing is allowed"
assert audit == [
    "pay: draft -> paid",
    "ship: paid -> shipped",
    "refund: shipped -> refunded",
]
print("\n✅ los estados ilegales truenan en el momento en que alguien los intenta")
