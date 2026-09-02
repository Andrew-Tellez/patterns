"""gof_patterns — all 22 GoF patterns as small, typed helpers.

MIT. https://refactoring.guru/design-patterns/catalog
"""

from .behavioral import (
    Command,
    CommandBus,
    Do,
    History,
    Mediator,
    StateMachine,
    Subject,
    chain,
    iterate,
    template,
    visitor,
)
from .creational import Builder, Registry, clone, singleton
from .structural import Composite, Flyweight, adapt, bridge, decorate, facade, lazy

__all__ = [
    "Builder",
    "Command",
    "CommandBus",
    "Composite",
    "Do",
    "Flyweight",
    "History",
    "Mediator",
    "Registry",
    "StateMachine",
    "Subject",
    "adapt",
    "bridge",
    "chain",
    "clone",
    "decorate",
    "facade",
    "iterate",
    "lazy",
    "singleton",
    "template",
    "visitor",
]
