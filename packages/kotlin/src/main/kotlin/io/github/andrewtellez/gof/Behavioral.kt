package io.github.andrewtellez.gof

/**
 * Chain of Responsibility — each handler either answers or calls `next()`.
 *
 * ```
 * val route = chain<Ticket, String>(
 *     listOf(
 *         { t, next -> if (t.level == 1) "bot" else next() },
 *         { t, next -> if (t.paid) "human" else next() },
 *     ),
 *     fallback = { "queue" },
 * )
 * ```
 */
public fun <Req, Res> chain(
    handlers: List<(Req, () -> Res) -> Res>,
    fallback: ((Req) -> Res)? = null,
): (Req) -> Res = { request ->
    fun step(i: Int): Res =
        if (i >= handlers.size) {
            fallback?.invoke(request)
                ?: error("chain: no handler answered and no fallback was given")
        } else {
            handlers[i](request) { step(i + 1) }
        }
    step(0)
}

/**
 * A command built from two lambdas, so the simple case needs no class of its own.
 * A command with no [undo] still runs, but cannot be undone.
 */
public class Command<out T>(
    private val execute: () -> T,
    public val undo: (() -> Unit)? = null,
) {
    public operator fun invoke(): T = execute()
}

/**
 * Command — undoable operations with history.
 *
 * ```
 * val bus = CommandBus()
 * bus.run(Command({ cart.add(sku) }, undo = { cart.remove(sku) }))
 * bus.undo()
 * bus.redo()
 * ```
 */
public class CommandBus {
    private val done: ArrayDeque<Command<*>> = ArrayDeque()
    private val undone: ArrayDeque<Command<*>> = ArrayDeque()

    public fun <T> run(command: Command<T>): T {
        val result = command()
        undone.clear()
        if (command.undo != null) done.addLast(command)
        return result
    }

    public fun undo(): Boolean {
        val command = done.removeLastOrNull() ?: return false
        command.undo?.invoke()
        undone.addLast(command)
        return true
    }

    public fun redo(): Boolean {
        val command = undone.removeLastOrNull() ?: return false
        command()
        done.addLast(command)
        return true
    }

    public val canUndo: Boolean get() = done.isNotEmpty()
    public val canRedo: Boolean get() = undone.isNotEmpty()
}

/**
 * Observer — one typed channel. [subscribe] returns the unsubscribe function.
 *
 * ```
 * val priceChanged = Subject<Double>()
 * val off = priceChanged.subscribe(::render)
 * priceChanged.emit(9.99)
 * off()
 * ```
 */
public class Subject<T> {
    private val listeners: MutableList<(T) -> Unit> = mutableListOf()

    public fun subscribe(listener: (T) -> Unit): () -> Unit {
        listeners += listener
        return { listeners.remove(listener) }
    }

    public fun emit(value: T) {
        // Iterate a copy: a listener may unsubscribe during emit.
        for (listener in listeners.toList()) listener(value)
    }

    public val size: Int get() = listeners.size
}

/**
 * Mediator — components talk to a hub, never to each other.
 *
 * Channels carry their payload type, so a listener cannot be attached to the wrong
 * event and `emit` cannot be given the wrong payload:
 *
 * ```
 * val invoicePaid = Mediator.Channel<Invoice>("invoice.paid")
 * hub.on(invoicePaid) { invoice -> mailer.send(invoice.id) }
 * hub.emit(invoicePaid, invoice)
 * ```
 */
public class Mediator {
    /** A named, typed event. Declare it once and share it; the name is only for debugging. */
    public class Channel<T>(public val name: String)

    private val subjects: MutableMap<Channel<*>, Subject<*>> = mutableMapOf()

    @Suppress("UNCHECKED_CAST")
    private fun <T> subjectFor(channel: Channel<T>): Subject<T> =
        subjects.getOrPut(channel) { Subject<T>() } as Subject<T>

    public fun <T> on(channel: Channel<T>, listener: (T) -> Unit): () -> Unit =
        subjectFor(channel).subscribe(listener)

    public fun <T> emit(channel: Channel<T>, payload: T): Unit = subjectFor(channel).emit(payload)
}

/**
 * Memento — undo/redo over snapshots of state.
 *
 * ```
 * val doc = History(text, limit = 50)
 * doc.save(next)
 * doc.undo()
 * ```
 *
 * Snapshots are stored by reference. Pass [snapshot] — a copy function — when the
 * state is mutated in place; with a `data class`, `copy()` is already what you want.
 */
public class History<T>(
    initial: T,
    private val limit: Int = Int.MAX_VALUE,
    private val snapshot: (T) -> T = { it },
) {
    private val past: ArrayDeque<T> = ArrayDeque()
    private val future: ArrayDeque<T> = ArrayDeque()

    public var current: T = snapshot(initial)
        private set

    public fun save(state: T) {
        past.addLast(current)
        if (past.size > limit) past.removeFirst()
        future.clear()
        current = snapshot(state)
    }

    public fun undo(): T? {
        val previous = past.removeLastOrNull() ?: return null
        future.addLast(current)
        current = previous
        return current
    }

    public fun redo(): T? {
        val next = future.removeLastOrNull() ?: return null
        past.addLast(current)
        current = next
        return current
    }

    public val canUndo: Boolean get() = past.isNotEmpty()
    public val canRedo: Boolean get() = future.isNotEmpty()
}

/**
 * State — a finite state machine from a transition table.
 *
 * ```
 * val order = StateMachine(
 *     initial = "draft",
 *     transitions = mapOf(
 *         "draft" to mapOf("pay" to "paid"),
 *         "paid" to mapOf("ship" to "sent"),
 *         "sent" to emptyMap(),
 *     ),
 * )
 * order.send("pay")  // "paid"
 * order.can("ship")  // true
 * ```
 *
 * States and events are type parameters, so a `sealed interface` or an `enum` works
 * and the compiler checks exhaustiveness where you `when` over them.
 */
public class StateMachine<S : Any, E : Any>(
    initial: S,
    private val transitions: Map<S, Map<E, S>>,
) {
    public var state: S = initial
        private set

    /** Emits every transition: the state before, the state after, and the event. */
    public val changes: Subject<Change<S, E>> = Subject()

    public data class Change<S, E>(val from: S, val to: S, val event: E)

    public fun can(event: E): Boolean = transitions[state]?.containsKey(event) == true

    /** Returns the new state. Throws on an event the current state does not allow. */
    public fun send(event: E): S {
        val target = transitions[state]?.get(event)
            ?: throw IllegalStateException("StateMachine: \"$event\" is not allowed in \"$state\"")
        val from = state
        state = target
        changes.emit(Change(from, state, event))
        return state
    }
}
