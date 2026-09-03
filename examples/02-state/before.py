"""Example 02 — State, the painful version.

Three independent booleans give eight combinations, of which only four are legal
orders. This file walks straight into two of the illegal ones, and nothing
complains.

Run it:  PYTHONPATH=packages/py python3 examples/02-state/before.py
"""

from dataclasses import dataclass


@dataclass
class Order:
    is_paid: bool = False
    is_shipped: bool = False
    is_refunded: bool = False


order = Order()
events: list[str] = []


def pay(o: Order) -> None:
    if o.is_paid:
        return
    o.is_paid = True
    events.append("paid")


def ship(o: Order) -> None:
    # The rule that matters — "you cannot ship what nobody paid" — lives here, in
    # this caller, and it is not written down anywhere else.
    if o.is_shipped:
        return
    o.is_shipped = True
    events.append("shipped")


def refund(o: Order) -> None:
    # This one forgot to check is_refunded. A one-line omission, and the most
    # common bug in this shape of code.
    o.is_refunded = True
    events.append("refunded")


ship(order)  # nobody paid
refund(order)
refund(order)  # and again

print(f"estado: {order}")
print(f"eventos: {', '.join(events)}")

assert order.is_shipped
assert not order.is_paid
assert events.count("refunded") == 2
print("\n⚠️  enviada sin pagar, y reembolsada dos veces — sin un solo error")
