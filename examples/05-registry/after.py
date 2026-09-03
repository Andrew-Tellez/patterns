"""Video 05 — Factory Method / Strategy, with the pattern.

Registration lives next to each implementation — and in Python it can be a
decorator, so the registration sits directly above the thing it registers.

Run it:  PYTHONPATH=packages/py python3 examples/05-registry/after.py
"""

from gof_patterns import Registry

rails: Registry = Registry()


# The decorator form: the registration is right above the implementation, which is
# what makes "a new rail is a new file" true rather than aspirational.
@rails.register("stripe")
def stripe():
    return lambda cents: f"stripe:{cents}"


@rails.register("spei")
def spei(clabe: str):
    return lambda cents: f"spei:{clabe}:{cents}"


results = [rails.create("stripe")(1999), rails.create("spei", "0123")(1999)]
for result in results:
    print(f"  {result}")

refused = ""
try:
    rails.create("paypal")
except KeyError as error:
    refused = str(error)
print(f"  desconocido → {refused}")

assert results == ["stripe:1999", "spei:0123:1999"]
assert "paypal" in refused

# Still a normal function, so it is testable on its own.
assert stripe()(1) == "stripe:1"
assert sorted(rails.keys()) == ["spei", "stripe"]

print("\n✅ el registro vive junto a la implementación, y lo desconocido truena")
