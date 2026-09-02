package io.github.andrewtellez.gof

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class CreationalTest {
    @Test
    fun `registry creates by key and names the key it does not know`() {
        val rails = Registry<String, (Int) -> String>("stripe" to { cents -> "stripe:$cents" })
        rails.register("spei") { cents -> "spei:$cents" }

        assertEquals("stripe:500", rails["stripe"](500))
        assertEquals("spei:500", rails["spei"](500))
        assertTrue("spei" in rails)
        assertFalse("paypal" in rails)
        assertEquals(setOf("stripe", "spei"), rails.keys)

        val error = assertFailsWith<NoSuchElementException> { rails["paypal"] }
        assertTrue(error.message!!.contains("paypal"))
    }

    @Test
    fun `object declaration is the singleton, no helper needed`() {
        assertSame(Config, Config)
        assertEquals(1, Config.built)
    }

    private object Config {
        val built: Int = 1
    }

    @Test
    fun `data class copy is the prototype, no helper needed`() {
        data class Order(val id: String, val cents: Int)

        val original = Order("a", 100)
        val clone = original.copy(cents = 200)
        assertEquals(100, original.cents)
        assertEquals("a", clone.id)
    }
}

class StructuralTest {
    @Test
    fun `decorate applies wrappers outermost first`() {
        val order = mutableListOf<String>()
        val outer: (() -> String) -> (() -> String) = { next -> { order += "outer"; next() } }
        val inner: (() -> String) -> (() -> String) = { next -> { order += "inner"; next() } }

        val call = decorate({ "core" }, outer, inner)
        assertEquals("core", call())
        assertEquals(listOf("outer", "inner"), order)
    }

    @Test
    fun `decorate with no wrappers returns the function itself`() {
        val fn = { 1 }
        assertSame(fn, decorate(fn))
    }

    @Test
    fun `composite aggregates over the tree`() {
        val child = Composite(5.0)
        val root = Composite(10.0, listOf(child, Composite(1.0)))

        assertEquals(16.0, root.sum { it })
        assertEquals(3, root.size)
        assertTrue(root.remove(child))
        assertEquals(11.0, root.sum { it })
        assertFalse(root.remove(child))
    }

    @Test
    fun `composite add appends and exposes children read-only`() {
        val root = Composite("a")
        assertEquals(emptyList(), root.children)

        val returned = root.add(Composite("b"), Composite("c"))
        assertSame(root, returned) // chainable
        assertEquals(listOf("b", "c"), root.children.map { it.value })
        assertEquals(3, root.size)
    }

    @Test
    fun `composite walk is lazy and depth first`() {
        val root = Composite("a", listOf(Composite("b", listOf(Composite("c")))))
        assertEquals(listOf("a", "b", "c"), root.walk().map { it.value }.toList())

        var visited = 0
        val found = root.walk().onEach { visited++ }.first { it.value == "b" }
        assertEquals("b", found.value)
        assertEquals(2, visited) // stopped early, never reached "c"
    }

    @Test
    fun `flyweight shares one instance per key`() {
        var built = 0
        val types = Flyweight<String, List<String>> { name -> built++; listOf(name) }

        assertSame(types["oak"], types["oak"])
        assertEquals(1, built)
        assertEquals(2, types.also { it["pine"] }.size)
        types.clear()
        assertEquals(0, types.size)
    }

    @Test
    fun `by lazy is the virtual proxy, no helper needed`() {
        var loaded = 0
        val heavy: String by lazy { loaded++; "built" }

        assertEquals(0, loaded)
        assertEquals("built", heavy)
        assertEquals("built", heavy)
        assertEquals(1, loaded)
    }
}

class BehavioralTest {
    @Test
    fun `chain stops at the first handler that answers`() {
        val route = chain<Int, String>(
            listOf(
                { level, next -> if (level == 1) "bot" else next() },
                { level, next -> if (level == 2) "human" else next() },
            ),
            fallback = { "queue" },
        )

        assertEquals("bot", route(1))
        assertEquals("human", route(2))
        assertEquals("queue", route(9))

        val error = assertFailsWith<IllegalStateException> { chain<Int, String>(emptyList())(1) }
        assertTrue(error.message!!.contains("no fallback"))
    }

    @Test
    fun `command bus undoes and redoes`() {
        val cart = mutableListOf<String>()
        val bus = CommandBus()
        fun add(sku: String) = bus.run(Command({ cart.add(sku) }, undo = { cart.removeLast() }))

        add("book")
        add("mug")
        assertEquals(listOf("book", "mug"), cart)
        assertTrue(bus.undo())
        assertEquals(listOf("book"), cart)
        assertTrue(bus.redo())
        assertEquals(listOf("book", "mug"), cart)
        assertFalse(bus.canRedo)

        bus.undo()
        bus.undo()
        assertFalse(bus.undo())
    }

    @Test
    fun `a command with no undo runs but is not tracked`() {
        val bus = CommandBus()
        assertEquals(42, bus.run(Command({ 42 })))
        assertFalse(bus.canUndo)
    }

    @Test
    fun `subject allows a listener to unsubscribe during emit`() {
        val seen = mutableListOf<Int>()
        val subject = Subject<Int>()
        var off: (() -> Unit)? = null
        off = subject.subscribe { n -> seen += n; off?.invoke() }
        subject.subscribe { n -> seen += n * 10 }

        subject.emit(1)
        subject.emit(2)
        assertEquals(listOf(1, 10, 20), seen)
        assertEquals(1, subject.size)
    }

    @Test
    fun `mediator keeps typed channels separate`() {
        val login = Mediator.Channel<String>("login")
        val logout = Mediator.Channel<Unit>("logout")
        val hub = Mediator()
        val seen = mutableListOf<String>()

        hub.on(login) { id -> seen += id }
        val off = hub.on(logout) { seen += "out" }

        hub.emit(login, "u1")
        hub.emit(logout, Unit)
        off()
        hub.emit(logout, Unit)

        assertEquals(listOf("u1", "out"), seen)
    }

    @Test
    fun `a mediator channel keeps its name for debugging`() {
        assertEquals("invoice.paid", Mediator.Channel<Int>("invoice.paid").name)
    }

    @Test
    fun `history undoes, redoes and drops the future on save`() {
        val history = History("")
        history.save("a")
        history.save("ab")

        assertEquals("a", history.undo())
        assertEquals("ab", history.redo())
        history.undo()
        history.save("ax")
        assertFalse(history.canRedo)
        assertEquals("ax", history.current)
        assertEquals("a", history.undo())
        assertEquals("", history.undo())
        assertNull(history.undo())
    }

    @Test
    fun `history honours the limit and the snapshot function`() {
        val limited = History(0, limit = 1)
        limited.save(1)
        limited.save(2)
        assertEquals(1, limited.undo())
        assertFalse(limited.canUndo)

        val mutable = mutableListOf("")
        val deep = History(mutable, snapshot = { it.toMutableList() })
        deep.save(mutable)
        mutable[0] = "mutated"
        assertEquals(listOf(""), deep.undo()?.toList())
    }

    @Test
    fun `state machine transitions and refuses illegal events`() {
        val order = StateMachine(
            initial = "draft",
            transitions = mapOf(
                "draft" to mapOf("pay" to "paid"),
                "paid" to mapOf("ship" to "sent"),
                "sent" to emptyMap(),
            ),
        )
        val audit = mutableListOf<String>()
        order.changes.subscribe { audit += "${it.event}: ${it.from} -> ${it.to}" }

        assertFalse(order.can("ship"))
        assertEquals("paid", order.send("pay"))
        assertEquals("sent", order.send("ship"))
        assertEquals(listOf("pay: draft -> paid", "ship: paid -> sent"), audit)

        val error = assertFailsWith<IllegalStateException> { order.send("pay") }
        assertTrue(error.message!!.contains("not allowed in \"sent\""))
    }

    @Test
    fun `an enum works as the state, so when over it stays exhaustive`() {
        val machine = StateMachine(
            initial = Status.DRAFT,
            transitions = mapOf(Status.DRAFT to mapOf("pay" to Status.PAID), Status.PAID to emptyMap()),
        )
        assertEquals(Status.PAID, machine.send("pay"))
    }

    private enum class Status { DRAFT, PAID }

    @Test
    fun `empty stacks and the flags that report them`() {
        val bus = CommandBus()
        assertFalse(bus.canUndo)
        assertFalse(bus.canRedo)
        assertFalse(bus.undo())
        assertFalse(bus.redo())

        bus.run(Command({ 1 }, undo = {}))
        assertTrue(bus.canUndo)
        assertTrue(bus.undo())
        assertTrue(bus.canRedo)

        val history = History("a")
        assertFalse(history.canUndo)
        assertFalse(history.canRedo)
        assertNull(history.redo())
        history.save("b")
        assertTrue(history.canUndo)
        history.undo()
        assertTrue(history.canRedo)
        assertEquals("b", history.redo())
    }

    @Test
    fun `can() is false for an unknown state and for an unknown event`() {
        val machine = StateMachine("draft", mapOf("draft" to mapOf("pay" to "paid")))
        assertTrue(machine.can("pay"))
        assertFalse(machine.can("ship"))       // state known, event not
        machine.send("pay")
        assertFalse(machine.can("ship"))       // state absent from the table entirely
        assertFailsWith<IllegalStateException> { machine.send("ship") }
    }

    @Test
    fun `default arguments are the template method, no helper needed`() {
        fun report(read: () -> String = { "a,b" }, parse: (String) -> List<String> = { it.split(",") }) =
            parse(read())

        assertEquals(listOf("a", "b"), report())
        assertEquals(listOf("x", "y", "z"), report(read = { "x,y,z" }))
    }
}
