"""Behavioral patterns.

Two need no helper — see the README table:

- Visitor  -> ``functools.singledispatch`` (dispatch on the node's type)
- Iterator -> generators and ``for`` are in the language
"""

from __future__ import annotations

import math
from typing import Any, Callable, Generic, Protocol, TypeVar

Req = TypeVar("Req")
Res = TypeVar("Res")
S = TypeVar("S")
T = TypeVar("T")


def chain(
    handlers: list[Callable[[Req, Callable[[], Res]], Res]],
    fallback: Callable[[Req], Res] | None = None,
) -> Callable[[Req], Res]:
    """Chain of Responsibility — each handler answers or calls ``next()``.

        route = chain(
            [lambda t, next: "bot" if t.level == 1 else next(),
             lambda t, next: "human" if t.paid else next()],
            fallback=lambda t: "queue",
        )
    """

    def run(request: Req) -> Res:
        def step(i: int) -> Res:
            if i >= len(handlers):
                if fallback is None:
                    raise RuntimeError("chain: no handler answered and no fallback was given")
                return fallback(request)
            return handlers[i](request, lambda: step(i + 1))

        return step(0)

    return run


class Command(Protocol):
    """A command must ``do``; ``undo`` is optional but required to be undoable."""

    def do(self) -> Any: ...


class CommandBus:
    """Command — undoable operations with history.

        bus = CommandBus()
        bus.run(Do(lambda: doc.append("a"), undo=doc.pop))
        bus.undo()
        bus.redo()

    A command with no ``undo`` still runs, but cannot be undone.
    """

    def __init__(self) -> None:
        self._done: list[Command] = []
        self._undone: list[Command] = []

    def run(self, command: Command) -> Any:
        result = command.do()
        self._undone.clear()
        if callable(getattr(command, "undo", None)):
            self._done.append(command)
        return result

    def undo(self) -> bool:
        if not self._done:
            return False
        command = self._done.pop()
        command.undo()  # type: ignore[attr-defined]
        self._undone.append(command)
        return True

    def redo(self) -> bool:
        if not self._undone:
            return False
        command = self._undone.pop()
        command.do()
        self._done.append(command)
        return True

    @property
    def can_undo(self) -> bool:
        return bool(self._done)

    @property
    def can_redo(self) -> bool:
        return bool(self._undone)


class Do:
    """A command from two callables, so simple cases need no class.

        Do(lambda: doc.append("a"), undo=doc.pop)
    """

    __slots__ = ("_do", "undo")

    def __init__(self, do: Callable[[], Any], undo: Callable[[], Any] | None = None) -> None:
        self._do = do
        if undo is not None:
            self.undo = undo

    def do(self) -> Any:
        return self._do()


class Subject(Generic[T]):
    """Observer — one typed channel. ``subscribe`` returns the unsubscribe.

        price_changed: Subject[float] = Subject()
        off = price_changed.subscribe(render)
        price_changed.emit(9.99)
        off()
    """

    def __init__(self) -> None:
        self._listeners: list[Callable[[T], None]] = []

    def subscribe(self, listener: Callable[[T], None]) -> Callable[[], None]:
        self._listeners.append(listener)

        def unsubscribe() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unsubscribe

    def emit(self, value: T) -> None:
        # Iterate a copy: a listener may unsubscribe during emit.
        for listener in list(self._listeners):
            listener(value)

    def __len__(self) -> int:
        return len(self._listeners)


class Mediator:
    """Mediator — components talk to a hub, never to each other.

        hub = Mediator()
        hub.on("login", lambda user: track(user))
        hub.emit("login", {"id": "u1"})
    """

    def __init__(self) -> None:
        self._channels: dict[str, Subject[Any]] = {}

    def _channel(self, event: str) -> Subject[Any]:
        return self._channels.setdefault(event, Subject())

    def on(self, event: str, listener: Callable[[Any], None]) -> Callable[[], None]:
        return self._channel(event).subscribe(listener)

    def emit(self, event: str, payload: Any = None) -> None:
        self._channel(event).emit(payload)


class History(Generic[T]):
    """Memento — undo/redo over snapshots of state.

        h = History({"text": ""}, snapshot=copy.deepcopy)
        h.save({"text": "hi"})
        h.undo()  # {"text": ""}

    Snapshots are stored by reference — pass ``snapshot=copy.deepcopy`` if the
    state is mutated in place.
    """

    def __init__(
        self,
        initial: T,
        limit: float = math.inf,
        snapshot: Callable[[T], T] = lambda state: state,
    ) -> None:
        self._limit = limit
        self._snapshot = snapshot
        self._past: list[T] = []
        self._future: list[T] = []
        self._present = snapshot(initial)

    @property
    def current(self) -> T:
        return self._present

    def save(self, state: T) -> None:
        self._past.append(self._present)
        if len(self._past) > self._limit:
            self._past.pop(0)
        self._future.clear()
        self._present = self._snapshot(state)

    def undo(self) -> T | None:
        if not self._past:
            return None
        self._future.append(self._present)
        self._present = self._past.pop()
        return self._present

    def redo(self) -> T | None:
        if not self._future:
            return None
        self._past.append(self._present)
        self._present = self._future.pop()
        return self._present

    @property
    def can_undo(self) -> bool:
        return bool(self._past)

    @property
    def can_redo(self) -> bool:
        return bool(self._future)


class StateMachine(Generic[S]):
    """State — a finite state machine from a transition table.

        order = StateMachine("draft", {
            "draft": {"pay": "paid"},
            "paid": {"ship": "sent"},
            "sent": {},
        })
        order.send("pay")   # "paid"
        order.can("ship")   # True

    A transition value may be a target state or a callable ``(payload) -> state``.
    """

    def __init__(self, initial: S, states: dict[S, dict[str, Any]]) -> None:
        self._state = initial
        self._states = states
        self.changes: Subject[tuple[S, S, str]] = Subject()

    @property
    def state(self) -> S:
        return self._state

    def _target(self, event: str) -> Any:
        return self._states.get(self._state, {}).get(event, _MISSING)

    def can(self, event: str) -> bool:
        return self._target(event) is not _MISSING

    def send(self, event: str, payload: Any = None) -> S:
        """Returns the new state. Raises on an event the current state disallows."""
        target = self._target(event)
        if target is _MISSING:
            raise ValueError(f"StateMachine: {event!r} is not allowed in {self._state!r}")
        previous = self._state
        self._state = target(payload) if callable(target) else target
        self.changes.emit((previous, self._state, event))
        return self._state


class _Missing:
    pass


_MISSING = _Missing()


def template(
    defaults: dict[str, Callable[..., Any]],
    skeleton: Callable[..., Any],
) -> Callable[..., Callable[..., Any]]:
    """Template Method — a fixed skeleton with replaceable steps.

        mine = template({"read": read_csv, "parse": lambda s: s.split(",")},
                        lambda hooks, *a: hooks["parse"](hooks["read"]()))
        mine(read=lambda: "a,b")()  # ["a", "b"]

    Subclassing works too; this is the version that needs no class.
    """

    def with_overrides(**overrides: Callable[..., Any]) -> Callable[..., Any]:
        hooks = {**defaults, **overrides}
        unknown = set(overrides) - set(defaults)
        if unknown:
            raise KeyError(f"template: unknown step(s) {sorted(unknown)}")

        def run(*args: Any, **kwargs: Any) -> Any:
            return skeleton(hooks, *args, **kwargs)

        return run

    return with_overrides
