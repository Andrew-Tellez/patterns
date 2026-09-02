import copy
import functools
import math
import unittest
from types import SimpleNamespace

from gof_patterns import (
    Builder,
    CommandBus,
    Composite,
    Do,
    Flyweight,
    History,
    Mediator,
    Registry,
    StateMachine,
    Subject,
    adapt,
    bridge,
    chain,
    clone,
    decorate,
    facade,
    iterate,
    lazy,
    singleton,
    template,
    visitor,
)


class TestCreational(unittest.TestCase):
    def test_registry_creates_by_key(self):
        shapes: Registry[dict] = Registry()
        shapes.register("circle", lambda r: {"r": r})
        self.assertEqual(shapes.create("circle", 2), {"r": 2})
        self.assertIn("circle", shapes)
        self.assertEqual(shapes.keys(), ["circle"])
        with self.assertRaisesRegex(KeyError, "nothing registered"):
            shapes.create("square")

    def test_registry_as_decorator(self):
        shapes: Registry[str] = Registry()

        @shapes.register("square")
        def square(side: int) -> str:
            return f"square:{side}"

        self.assertEqual(shapes.create("square", 3), "square:3")
        self.assertEqual(square(1), "square:1")  # still a normal function

    def test_singleton_is_functools_cache(self):
        calls = []

        @functools.cache
        def db():
            calls.append(1)
            return object()

        self.assertIs(db(), db())
        self.assertEqual(len(calls), 1)
        db.cache_clear()
        self.assertEqual(len(calls), 1)
        db()
        self.assertEqual(len(calls), 2)


class TestStructural(unittest.TestCase):
    def test_adapt_exposes_wanted_interface(self):
        class Legacy:
            def send_message(self, m):
                return f"sent:{m}"

        api = adapt(Legacy(), log=lambda legacy: legacy.send_message)
        self.assertEqual(api.log("hi"), "sent:hi")

    def test_decorate_applies_outermost_first(self):
        order = []

        def outer(next_):
            def run(*a):
                order.append("outer")
                return next_(*a)

            return run

        def inner(next_):
            def run(*a):
                order.append("inner")
                return next_(*a)

            return run

        def core():
            """core docstring"""
            return "core"

        wrapped = decorate(core, outer, inner)
        self.assertEqual(wrapped(), "core")
        self.assertEqual(order, ["outer", "inner"])
        self.assertEqual(wrapped.__doc__, "core docstring")  # functools.wraps kept it

    def test_composite_aggregates_over_tree(self):
        root = Composite({"price": 10})
        child = Composite({"price": 5})
        root.add(child, Composite({"price": 1}))
        self.assertEqual(root.sum(lambda v: v["price"]), 16)
        self.assertEqual(len(root), 3)
        self.assertTrue(root.remove(child))
        self.assertEqual(root.sum(lambda v: v["price"]), 11)
        self.assertFalse(root.remove(child))

    def test_lazy_defers_construction(self):
        loaded = []

        class Thing:
            value = 7

        def load():
            loaded.append(1)
            return Thing()

        thing = lazy(load)
        self.assertEqual(loaded, [])
        self.assertEqual(thing.value, 7)
        self.assertEqual(thing.value, 7)
        self.assertEqual(loaded, [1])
        thing.value = 8
        self.assertEqual(thing.value, 8)

    def test_flyweight_is_lru_cache(self):
        @functools.lru_cache
        def tree_type(name, color):
            return (name, color)

        self.assertIs(tree_type("oak", "green"), tree_type("oak", "green"))
        self.assertEqual(tree_type.cache_info().currsize, 1)


class TestBehavioral(unittest.TestCase):
    def test_chain_stops_at_first_answer(self):
        route = chain(
            [
                lambda level, next_: "bot" if level == 1 else next_(),
                lambda level, next_: "human" if level == 2 else next_(),
            ],
            fallback=lambda level: "queue",
        )
        self.assertEqual(route(1), "bot")
        self.assertEqual(route(2), "human")
        self.assertEqual(route(9), "queue")
        with self.assertRaisesRegex(RuntimeError, "no fallback"):
            chain([])(1)

    def test_command_bus_undo_redo(self):
        doc = []
        bus = CommandBus()
        bus.run(Do(lambda: doc.append("a"), undo=doc.pop))
        bus.run(Do(lambda: doc.append("b"), undo=doc.pop))
        self.assertEqual(doc, ["a", "b"])
        self.assertTrue(bus.undo())
        self.assertEqual(doc, ["a"])
        self.assertTrue(bus.redo())
        self.assertEqual(doc, ["a", "b"])
        self.assertFalse(bus.can_redo)
        bus.undo()
        bus.undo()
        self.assertFalse(bus.undo())

    def test_command_without_undo_is_not_tracked(self):
        bus = CommandBus()
        self.assertEqual(bus.run(Do(lambda: 42)), 42)
        self.assertFalse(bus.can_undo)

    def test_subject_allows_unsubscribe_during_emit(self):
        seen = []
        s: Subject[int] = Subject()

        def once(n):
            seen.append(n)
            off()

        off = s.subscribe(once)
        s.subscribe(lambda n: seen.append(n * 10))
        s.emit(1)
        s.emit(2)
        self.assertEqual(seen, [1, 10, 20])
        self.assertEqual(len(s), 1)

    def test_mediator_keeps_channels_separate(self):
        hub = Mediator()
        seen = []
        hub.on("login", lambda user: seen.append(user["id"]))
        hub.on("logout", lambda _: seen.append("out"))
        hub.emit("login", {"id": "u1"})
        hub.emit("logout")
        self.assertEqual(seen, ["u1", "out"])

    def test_history_undo_redo_and_dropped_future(self):
        h = History("")
        h.save("a")
        h.save("ab")
        self.assertEqual(h.undo(), "a")
        self.assertEqual(h.redo(), "ab")
        h.undo()
        h.save("ax")
        self.assertFalse(h.can_redo)
        self.assertEqual(h.current, "ax")
        self.assertEqual(h.undo(), "a")
        self.assertEqual(h.undo(), "")
        self.assertIsNone(h.undo())

    def test_history_limit_and_snapshot(self):
        h = History(0, limit=1)
        h.save(1)
        h.save(2)
        self.assertEqual(h.undo(), 1)
        self.assertFalse(h.can_undo)

        state = {"text": ""}
        deep = History(state, snapshot=copy.deepcopy)
        deep.save(state)
        state["text"] = "mutated"
        self.assertEqual(deep.undo(), {"text": ""})

    def test_state_machine_transitions(self):
        order = StateMachine(
            "draft",
            {"draft": {"pay": "paid"}, "paid": {"ship": "sent"}, "sent": {}},
        )
        changes = []
        order.changes.subscribe(lambda c: changes.append(f"{c[0]}->{c[1]}"))
        self.assertFalse(order.can("ship"))
        self.assertEqual(order.send("pay"), "paid")
        self.assertEqual(order.send("ship"), "sent")
        self.assertEqual(changes, ["draft->paid", "paid->sent"])
        with self.assertRaisesRegex(ValueError, "not allowed in 'sent'"):
            order.send("pay")

    def test_state_machine_dynamic_target(self):
        gate = StateMachine("closed", {"closed": {"try": lambda ok: "open" if ok else "closed"}})
        self.assertEqual(gate.send("try", False), "closed")
        self.assertEqual(gate.send("try", True), "open")

    def test_visitor_is_singledispatch(self):
        import math

        class Circle:
            r = 1

        class Square:
            side = 3

        @functools.singledispatch
        def area(shape):
            raise TypeError(f"no visitor for {type(shape).__name__}")

        area.register(Circle, lambda c: math.pi * c.r**2)
        area.register(Square, lambda s: s.side**2)

        self.assertEqual(area(Square()), 9)
        with self.assertRaisesRegex(TypeError, "no visitor"):
            area(object())

    def test_template_replaces_only_overridden_steps(self):
        run = template(
            {"read": lambda: "a,b", "parse": lambda s: s.split(",")},
            lambda hooks: hooks["parse"](hooks["read"]()),
        )
        self.assertEqual(run()(), ["a", "b"])
        self.assertEqual(run(read=lambda: "x,y,z")(), ["x", "y", "z"])
        with self.assertRaisesRegex(KeyError, "unknown step"):
            run(nope=lambda: None)


class TestParity(unittest.TestCase):
    """Cases the TypeScript suite covers too — kept in step on purpose."""

    def test_registry_accepts_creators_up_front(self):
        shapes: Registry[dict] = Registry(circle=lambda r: {"r": r})
        self.assertEqual(shapes.create("circle", 1), {"r": 1})
        self.assertIn("circle", shapes)
        self.assertNotIn("square", shapes)

    def test_adapt_maps_several_methods_at_once(self):
        class Legacy:
            def get(self, k):
                return f"v:{k}"

            def put(self, k):
                return f"ok:{k}"

        legacy = Legacy()
        api = adapt(
            legacy,
            read=lambda l: l.get,
            write=lambda l: l.put,
            describe=lambda l: lambda: type(l).__name__,
        )
        self.assertEqual(api.read("a"), "v:a")
        self.assertEqual(api.write("a"), "ok:a")
        self.assertEqual(api.describe(), "Legacy")

    def test_composite_accepts_children_up_front(self):
        root = Composite({"n": 1}, [Composite({"n": 2}), Composite({"n": 3})])
        self.assertEqual(root.sum(lambda v: v["n"]), 6)

    def test_mediator_unsubscribes(self):
        hub = Mediator()
        seen = []
        off = hub.on("tick", lambda _: seen.append(1))
        hub.emit("tick")
        off()
        hub.emit("tick")
        self.assertEqual(seen, [1])
        off()  # unsubscribing twice must not raise

    def test_decorate_with_no_wrappers_returns_the_function(self):
        def fn():
            return 1

        self.assertIs(decorate(fn), fn)

    def test_template_passes_arguments_through(self):
        run = template(
            {"scale": lambda n: n * 2},
            lambda hooks, n: hooks["scale"](n),
        )
        self.assertEqual(run()(5), 10)
        self.assertEqual(run(scale=lambda n: n + 1)(5), 6)

    def test_chain_handlers_receive_the_request(self):
        seen = []
        route = chain(
            [lambda req, next_: seen.append(req) or next_()],
            fallback=lambda req: "end",
        )
        self.assertEqual(route("payload"), "end")
        self.assertEqual(seen, ["payload"])


class TestCompletedCatalog(unittest.TestCase):
    """The eight patterns that previously pointed at the stdlib instead of shipping code."""

    def test_singleton_builds_once_and_resets(self):
        calls = []
        get = singleton(lambda: calls.append(1) or object())
        self.assertIs(get(), get())
        self.assertEqual(len(calls), 1)
        get.reset()
        get()
        self.assertEqual(len(calls), 2)

    def test_clone_is_deep(self):
        source = {"a": {"b": 1}}
        copied = clone(source)
        copied["a"]["b"] = 2
        self.assertEqual(source["a"]["b"], 1)

    def test_builder_produces_a_dict_by_default(self):
        self.assertEqual(Builder(size="M").cheese(True).size("L").build(), {"size": "L", "cheese": True})

    def test_builder_calls_a_constructor(self):
        class Pizza:
            def __init__(self, size, cheese=False):
                self.size, self.cheese = size, cheese

        pizza = Builder(Pizza, size="M").size("L").cheese(True).build()
        self.assertEqual((pizza.size, pizza.cheese), ("L", True))

    def test_builder_set_handles_awkward_keys(self):
        self.assertEqual(Builder().set(**{"content-type": "json"}).build(), {"content-type": "json"})

    def test_flyweight_shares_one_instance_per_key(self):
        built = []
        types = Flyweight(lambda name, color: built.append(name) or (name, color))
        self.assertIs(types["oak", "green"], types["oak", "green"])
        self.assertEqual(len(built), 1)
        self.assertIsNot(types["oak", "green"], types["pine", "green"])
        self.assertEqual(len(types), 2)
        types.clear()
        self.assertEqual(len(types), 0)

    def test_flyweight_honours_a_custom_key(self):
        by_name = Flyweight(lambda name, color: (name, color), key=lambda name, color: name)
        self.assertIs(by_name["oak", "green"], by_name["oak", "brown"])
        self.assertEqual(len(by_name), 1)

    def test_flyweight_accepts_a_single_argument(self):
        types = Flyweight(lambda name: [name])
        self.assertIs(types["oak"], types["oak"])

    def test_facade_builds_a_subsystem_only_when_needed(self):
        built = []

        def payments():
            built.append("payments")
            return SimpleNamespace(charge=lambda cents: f"charged:{cents}")

        def mail():
            built.append("mail")
            return SimpleNamespace(send=lambda to: f"sent:{to}")

        checkout = facade(
            {"payments": payments, "mail": mail},
            lambda parts: SimpleNamespace(
                pay=lambda cents: parts.payments.charge(cents),
                receipt=lambda to: parts.mail.send(to),
            ),
        )

        self.assertEqual(built, [])
        self.assertEqual(checkout.pay(1999), "charged:1999")
        self.assertEqual(built, ["payments"])
        checkout.pay(1)
        self.assertEqual(built, ["payments"])
        self.assertEqual(checkout.receipt("a@b.c"), "sent:a@b.c")
        self.assertEqual(built, ["payments", "mail"])

    def test_facade_names_an_unknown_subsystem(self):
        f = facade({}, lambda parts: parts)
        with self.assertRaisesRegex(AttributeError, "no subsystem named"):
            f.nope

    def test_bridge_keeps_the_reference_stable_across_a_swap(self):
        s3 = SimpleNamespace(put=lambda k, v: f"s3:{k}={v}")
        disk = SimpleNamespace(put=lambda k, v: f"disk:{k}={v}")

        storage = bridge(lambda impl: SimpleNamespace(save=impl.put), s3)
        captured = storage

        self.assertEqual(captured.save("a", "1"), "s3:a=1")
        storage.swap(disk)
        self.assertEqual(captured.save("a", "1"), "disk:a=1")

    def test_visitor_dispatches_on_a_tag_field(self):
        area = visitor({
            "circle": lambda c: round(math.pi * c["r"] ** 2, 4),
            "square": lambda s: s["side"] ** 2,
        })
        self.assertEqual(area({"type": "square", "side": 3}), 9)
        self.assertEqual(area({"type": "circle", "r": 1}), 3.1416)

        with self.assertRaisesRegex(KeyError, "no visitor for"):
            area({"type": "hexagon"})

        self.assertEqual(visitor({}, fallback=lambda n: -1)({"type": "x"}), -1)

    def test_visitor_works_on_objects_and_a_custom_field(self):
        node = SimpleNamespace(kind="leaf", value=2)
        double = visitor({"leaf": lambda n: n.value * 2}, kind="kind")
        self.assertEqual(double(node), 4)

    def test_iterate_walks_an_external_cursor_lazily(self):
        class Cursor:
            def __init__(self, rows):
                self.rows, self.i = rows, 0

            def has_next(self):
                return self.i < len(self.rows)

            def next(self):
                row = self.rows[self.i]
                self.i += 1
                return row

        self.assertEqual(list(iterate(Cursor(["a", "b", "c"]))), ["a", "b", "c"])

        cursor = Cursor(["a", "b", "c"])
        for row in iterate(cursor):
            if row == "b":
                break
        self.assertEqual(cursor.i, 2)  # never pulled "c"

    def test_iterate_accepts_a_camelcase_sdk_cursor(self):
        source = SimpleNamespace(rows=iter([1, 2]), hasNext=lambda: True)
        pulled = []

        class Sdk:
            def __init__(self):
                self.i = 0

            def hasNext(self):  # noqa: N802 - mimicking a vendor SDK
                return self.i < 2

            def next(self):
                self.i += 1
                pulled.append(self.i)
                return self.i

        self.assertEqual(list(iterate(Sdk())), [1, 2])
        self.assertEqual(pulled, [1, 2])


if __name__ == "__main__":
    unittest.main()
