"""Example 04 — Decorator, the painful version.

Retry and logging are tangled in the same loop, the loop is copy-pasted, and the two
copies have already drifted. One charge produces three log lines, which reads as
three charge attempts on a dashboard.

Run it:  PYTHONPATH=packages/py python3 examples/04-decorator/before.py
"""

log: list[str] = []
attempts = 0


def raw_charge(cents: int) -> str:
    global attempts
    attempts += 1
    if attempts < 3:
        raise RuntimeError("502 from provider")
    return f"ch_{cents}"


def charge(cents: int) -> str:
    for attempt in range(4):
        # The log line lives inside the loop because that is where it was written,
        # not because anyone decided it belonged there.
        log.append(f"charging {cents}")
        try:
            return raw_charge(cents)
        except RuntimeError:
            if attempt >= 3:
                raise
    raise AssertionError("unreachable")


def refund(cents: int) -> str:
    # The same loop, copied — and it already drifted to 2 retries.
    for attempt in range(3):
        log.append(f"refunding {cents}")
        try:
            return raw_charge(cents)
        except RuntimeError:
            if attempt >= 2:
                raise
    raise AssertionError("unreachable")


result = charge(1999)

print(f"resultado: {result}")
print(f"intentos:  {attempts}")
print(f"log ({len(log)} líneas):")
for line in log:
    print(f"  {line}")

assert result == "ch_1999"
assert attempts == 3
assert len(log) == 3, "one charge, three log lines"
assert refund
print("\n⚠️  un cobro, tres líneas de log — parece tres cobros en el dashboard")
