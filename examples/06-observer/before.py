"""Video 06 — Observer / Mediator, the painful version.

The function that charges the card also emails, tracks, writes the ledger and
notifies the CRM. Testing "charge" means loading all four.

Run it:  PYTHONPATH=packages/py python3 examples/06-observer/before.py
"""

effects: list[str] = []


def pay_invoice(invoice_id: str, cents: int) -> str:
    charge = f"ch_{cents}"

    # Four dependencies the payment logic did not need, and a fifth on the way.
    effects.append(f"email:{invoice_id}")
    effects.append(f"analytics:{cents}")
    effects.append(f"ledger:{invoice_id}")
    effects.append(f"crm:{invoice_id}")

    return charge


charge = pay_invoice("inv_1", 1999)
print(f"cobro: {charge}")
print(f"efectos: {', '.join(effects)}")

assert charge == "ch_1999"
assert len(effects) == 4
print('\n⚠️  para probar "cobrar" hay que cargar mailer, analytics, ledger y crm')
