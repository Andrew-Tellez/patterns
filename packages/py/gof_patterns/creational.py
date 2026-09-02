"""Creational patterns.

Four of the five need no helper in Python — the stdlib or the language already
covers them. See the README table for what to write instead:

- Singleton  -> ``functools.cache`` on a zero-argument factory
- Prototype  -> ``copy.deepcopy``
- Builder    -> keyword arguments and ``dataclasses.replace``
"""

from __future__ import annotations

from typing import Any, Callable, Generic, TypeVar

T = TypeVar("T")


class Registry(Generic[T]):
    """Factory Method / Abstract Factory / Strategy — creators keyed by name.

    Register directly or as a decorator::

        shapes: Registry[Shape] = Registry()

        @shapes.register("circle")
        def _(r: float) -> Shape:
            return Circle(r)

        shapes.create("circle", 2)
    """

    def __init__(self, **creators: Callable[..., T]) -> None:
        self._creators: dict[str, Callable[..., T]] = dict(creators)

    def register(
        self, key: str, creator: Callable[..., T] | None = None
    ) -> Callable[..., T] | Callable[[Callable[..., T]], Callable[..., T]]:
        if creator is None:  # decorator form
            def decorator(fn: Callable[..., T]) -> Callable[..., T]:
                self._creators[key] = fn
                return fn

            return decorator
        self._creators[key] = creator
        return creator

    def create(self, key: str, *args: Any, **kwargs: Any) -> T:
        try:
            creator = self._creators[key]
        except KeyError:
            raise KeyError(f"Registry: nothing registered for {key!r}") from None
        return creator(*args, **kwargs)

    def __contains__(self, key: object) -> bool:
        return key in self._creators

    def keys(self) -> list[str]:
        return list(self._creators)
