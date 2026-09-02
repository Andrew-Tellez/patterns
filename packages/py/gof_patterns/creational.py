"""Creational patterns.

Three of these wrap something the standard library already does. They exist so the
catalog is complete and so the API matches the other language packages; where the
stdlib version is the better choice, the docstring says so.
"""

from __future__ import annotations

import copy
import functools
from typing import Any, Callable, Generic, TypeVar

T = TypeVar("T")


def singleton(factory: Callable[[], T]) -> Callable[[], T]:
    """Singleton — one lazily created instance, shared.

        db = singleton(lambda: connect(url))
        db() is db()   # True
        db.reset()     # drop it (tests)

    ``functools.cache`` on a zero-argument function does the same thing with
    ``cache_clear()`` instead of ``reset()``. Prefer it when you own the function;
    use this when you have a factory in hand, or want the same name as the
    TypeScript and Kotlin packages.
    """
    cached = functools.cache(factory)
    wrapper: Any = cached
    wrapper.reset = cached.cache_clear
    return wrapper


def clone(value: T) -> T:
    """Prototype — a deep copy, so a new object starts from an existing one.

    A one-line alias for ``copy.deepcopy``; import that directly if you are not
    reaching for the rest of this package. Use ``copy.copy`` when a shallow copy is
    enough, and ``dataclasses.replace`` to copy with changes.
    """
    return copy.deepcopy(value)


class Builder(Generic[T]):
    """Builder — fluent, step-by-step construction.

        pizza = Builder(Pizza, size="M").cheese(True).size("L").build()

    Python's keyword arguments with defaults cover most of what a builder is for,
    and are more idiomatic: prefer ``Pizza(size="L", cheese=True)``. This earns its
    place when construction is spread over branches — a query built from optional
    filters, a request assembled across several ``if`` blocks — where you would
    otherwise accumulate a dict and splat it.
    """

    def __init__(self, build: Callable[..., T] | None = None, **defaults: Any) -> None:
        self._build = build
        self._draft: dict[str, Any] = dict(defaults)

    def __getattr__(self, name: str) -> Callable[[Any], "Builder[T]"]:
        if name.startswith("_"):  # never intercept internals
            raise AttributeError(name)

        def setter(value: Any) -> "Builder[T]":
            self._draft[name] = value
            return self

        return setter

    def set(self, **values: Any) -> "Builder[T]":
        """Set several fields at once, for the ones that are not valid identifiers."""
        self._draft.update(values)
        return self

    def build(self) -> T:
        if self._build is None:
            return dict(self._draft)  # type: ignore[return-value]
        return self._build(**self._draft)


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
