"""Example 04 — Decorator, with the pattern.

Each concern is its own wrapper, and the composition line says what order they run
in. Swap the arguments and the original bug comes back — which is the point: the
order is now a visible decision instead of an accident in a loop.

Run it:  PYTHONPATH=packages/py python3 examples/04-decorator/after.py
"""

from gof_patterns import decorate

log: list[str] = []
attempts = 0


def raw_charge(cents: int) -> str:
    """Charge the provider."""
    global attempts
    attempts += 1
    if attempts < 3:
        raise RuntimeError("502 from provider")
    return f"ch_{cents}"


def with_log(next_):
    def run(cents: int) -> str:
        log.append(f"charging {cents}")
        return next_(cents)

    return run


def with_retry(times: int):
    """Knows nothing about payments: it works on anything of this shape."""

    def wrapper(next_):
        def run(cents: int) -> str:
            for attempt in range(times + 1):
                try:
                    return next_(cents)
                except RuntimeError:
                    if attempt >= times:
                        raise
            raise AssertionError("unreachable")

        return run

    return wrapper


# Reads in the order it runs: log first, then retries, then the real call.
charge = decorate(raw_charge, with_log, with_retry(3))

result = charge(1999)
print(f"resultado: {result}")
print(f"intentos:  {attempts}")
print(f"log:       {len(log)} línea → {log[0]}")

assert result == "ch_1999"
assert attempts == 3, "still retried three times"
assert len(log) == 1, "but logged once"

# decorate applies functools.wraps, so the identity of the original survives.
print(f"nombre:    {charge.__name__} — {charge.__doc__}")
assert charge.__name__ == "raw_charge"
assert charge.__doc__ == "Charge the provider."

# Swap the two wrappers and the original bug is back — on purpose.
attempts = 0
noisy_log: list[str] = []


def noisy_with_log(next_):
    def run(cents: int) -> str:
        noisy_log.append(f"charging {cents}")
        return next_(cents)

    return run


noisy = decorate(raw_charge, with_retry(3), noisy_with_log)
noisy(1999)
print(f"al invertir el orden: {len(noisy_log)} líneas de log")
assert len(noisy_log) == 3, "order is a decision, and now a visible one"

print("\n✅ un log por llamada, el orden explícito, y wraps preserva la identidad")
