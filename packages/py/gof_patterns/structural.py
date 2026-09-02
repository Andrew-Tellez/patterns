"""Structural patterns."""

from __future__ import annotations

import functools
from types import SimpleNamespace
from typing import Any, Callable, Generic, Iterator, TypeVar

T = TypeVar("T")


def adapt(source: Any, **methods: Callable[[Any], Any]) -> SimpleNamespace:
    """Adapter — expose an incompatible object through the interface you want.

        api = adapt(legacy, log=lambda l: l.send_message)
        api.log("hi")
    """
    return SimpleNamespace(**{name: build(source) for name, build in methods.items()})


def decorate(fn: Callable[..., Any], *wrappers: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator — wrap a callable in layers. The first wrapper is outermost.

        fetch_user = decorate(raw_fetch_user, with_log, with_retry(3))

    Same composition ``@with_log`` gives you, but applied to an existing object
    at runtime and readable left-to-right.
    """
    wrapped = fn
    for wrapper in reversed(wrappers):
        wrapped = functools.wraps(fn)(wrapper(wrapped))
    return wrapped


class Composite(Generic[T]):
    """Composite — treat a tree of nodes like a single node.

        box = Composite({"price": 10})
        box.add(Composite({"price": 5}))
        box.sum(lambda v: v["price"])  # 15
    """

    def __init__(self, value: T, children: list["Composite[T]"] | None = None) -> None:
        self.value = value
        self.children: list[Composite[T]] = children if children is not None else []

    def add(self, *children: "Composite[T]") -> "Composite[T]":
        self.children.extend(children)
        return self

    def remove(self, child: "Composite[T]") -> bool:
        try:
            self.children.remove(child)
        except ValueError:
            return False
        return True

    def walk(self) -> Iterator["Composite[T]"]:
        """Depth-first, self first."""
        yield self
        for child in self.children:
            yield from child.walk()

    def sum(self, of: Callable[[T], float]) -> float:
        return sum(of(node.value) for node in self.walk())

    def __len__(self) -> int:
        return sum(1 for _ in self.walk())


class lazy(Generic[T]):  # noqa: N801 - reads as a function at the call site
    """Proxy (virtual) — build the real object on first attribute access.

        heavy = lazy(load_huge_thing)  # nothing loaded yet
        heavy.query("x")               # loads now, once
    """

    __slots__ = ("_loader", "_target")

    def __init__(self, loader: Callable[[], T]) -> None:
        object.__setattr__(self, "_loader", loader)
        object.__setattr__(self, "_target", None)

    def _resolve(self) -> T:
        target = object.__getattribute__(self, "_target")
        if target is None:
            target = object.__getattribute__(self, "_loader")()
            object.__setattr__(self, "_target", target)
        return target

    def __getattr__(self, name: str) -> Any:
        return getattr(self._resolve(), name)

    def __setattr__(self, name: str, value: Any) -> None:
        setattr(self._resolve(), name, value)


class Flyweight(Generic[T]):
    """Flyweight — share one instance per key instead of re-creating equal objects.

        tree_types = Flyweight(lambda name, color: TreeType(name, color))
        tree_types["oak", "green"] is tree_types["oak", "green"]   # True

    ``functools.lru_cache`` does the same and gives you ``cache_info()``; prefer it
    when you own the factory function. This exists for a factory passed in at
    runtime, and for a custom key — the ``key`` argument lets several different
    argument tuples share one instance.
    """

    def __init__(
        self,
        factory: Callable[..., T],
        key: Callable[..., Any] | None = None,
    ) -> None:
        self._factory = factory
        self._key = key
        self._cache: dict[Any, T] = {}

    def __getitem__(self, args: Any) -> T:
        args = args if isinstance(args, tuple) else (args,)
        cache_key = self._key(*args) if self._key else args
        if cache_key not in self._cache:
            self._cache[cache_key] = self._factory(*args)
        return self._cache[cache_key]

    def __len__(self) -> int:
        return len(self._cache)

    def clear(self) -> None:
        self._cache.clear()


def facade(subsystems: dict[str, Callable[[], Any]], build: Callable[[Any], T]) -> T:
    """Facade — one small interface over several subsystems, each built only if the
    operation you called actually needs it.

        checkout = facade(
            {"payments": lambda: PaymentClient(key), "mail": lambda: Mailer(smtp)},
            lambda parts: SimpleNamespace(
                pay=lambda cents: parts.payments.charge(cents),
                receipt=lambda to: parts.mail.send(to),
            ),
        )
        checkout.pay(1999)   # Mailer was never constructed

    Without the lazy part this would be ``build(parts)`` and not worth a helper.
    With it, a facade over six subsystems costs one subsystem per call.
    """

    class _Parts:
        def __getattr__(self, name: str) -> Any:
            if name not in subsystems:
                raise AttributeError(f"facade: no subsystem named {name!r}")
            value = subsystems[name]()
            setattr(self, name, value)  # built once
            return value

    return build(_Parts())


class bridge(Generic[T]):  # noqa: N801 - reads as a function at the call site
    """Bridge — a stable abstraction whose implementation can be swapped underneath.

        storage = bridge(lambda impl: Api(save=impl.put), S3Storage())
        store(storage)              # callers keep this reference forever
        storage.swap(DiskStorage()) # and now they are writing to disk

    The point is the stable reference: callers that captured ``storage`` follow the
    swap. Passing the implementation into a constructor — the textbook version —
    makes every caller re-wire when it changes.
    """

    __slots__ = ("_build", "_current")

    def __init__(self, build: Callable[[Any], T], implementation: Any) -> None:
        object.__setattr__(self, "_build", build)
        object.__setattr__(self, "_current", build(implementation))

    def swap(self, implementation: Any) -> None:
        object.__setattr__(self, "_current", object.__getattribute__(self, "_build")(implementation))

    def __getattr__(self, name: str) -> Any:
        return getattr(object.__getattribute__(self, "_current"), name)
