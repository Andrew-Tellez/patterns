"""Video 06 — Observer / Mediator, with the pattern.

`pay_invoice` announces what happened and knows nothing about who cares.

Run it:  PYTHONPATH=packages/py python3 examples/06-observer/after.py
"""

from gof_patterns import Mediator

hub = Mediator()
effects: list[str] = []

# Each of these would live in the module that owns that effect.
hub.on("invoice.paid", lambda event: effects.append(f"email:{event['id']}"))
hub.on("invoice.paid", lambda event: effects.append(f"analytics:{event['cents']}"))
off_ledger = hub.on("invoice.paid", lambda event: effects.append(f"ledger:{event['id']}"))


def pay_invoice(invoice_id: str, cents: int) -> str:
    charge = f"ch_{cents}"
    hub.emit("invoice.paid", {"id": invoice_id, "cents": cents})  # the whole coupling
    return charge


charge = pay_invoice("inv_1", 1999)
print(f"cobro: {charge}")
print(f"efectos: {', '.join(effects)}")

off_ledger()  # the ledger goes away and the publisher never knew it existed
pay_invoice("inv_2", 500)
print(f"después de quitar el ledger: {', '.join(effects[3:])}")

assert charge == "ch_1999"
assert effects == [
    "email:inv_1",
    "analytics:1999",
    "ledger:inv_1",
    "email:inv_2",
    "analytics:500",
]
print("\n✅ el cobro anuncia y ya; los efectos viven donde viven")
