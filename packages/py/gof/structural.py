"""Structural patterns.

Three need no helper — see the README table:

- Flyweight -> ``functools.lru_cache`` (shared instances per key, plus
  ``cache_clear`` and ``cache_info`` for free)
- Facade    -> an object that delegates. Just write it.
- Bridge    -> pass the implementation in. Just write it.
"""

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
