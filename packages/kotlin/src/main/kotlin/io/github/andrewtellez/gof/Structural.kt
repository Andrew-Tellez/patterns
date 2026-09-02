package io.github.andrewtellez.gof

import java.util.concurrent.ConcurrentHashMap

/**
 * Decorator — wrap a function in layers (retry, cache, log) without touching it.
 * The first wrapper is the outermost, so the list reads in the order it runs.
 *
 * ```
 * val charge = decorate(rawCharge, ::withLog, withRetry(3))
 * ```
 */
public fun <F> decorate(fn: F, vararg wrappers: (F) -> F): F =
    wrappers.foldRight(fn) { wrap, next -> wrap(next) }

/**
 * Composite — treat a tree of nodes like a single node.
 *
 * ```
 * val box = Composite(Item(price = 10.0), listOf(Composite(Item(price = 5.0))))
 * box.sum { it.price } // 15.0
 * ```
 */
public class Composite<T>(public val value: T, children: List<Composite<T>> = emptyList()) {
    private val mutableChildren: MutableList<Composite<T>> = children.toMutableList()

    public val children: List<Composite<T>> get() = mutableChildren

    public fun add(vararg nodes: Composite<T>): Composite<T> {
        mutableChildren += nodes
        return this
    }

    public fun remove(child: Composite<T>): Boolean = mutableChildren.remove(child)

    /**
     * Depth-first, self first. A [Sequence], so `filter`, `first` and early exit all
     * work without walking the rest of the tree.
     */
    public fun walk(): Sequence<Composite<T>> = sequence {
        yield(this@Composite)
        for (child in mutableChildren) yieldAll(child.walk())
    }

    public fun sum(of: (T) -> Double): Double = walk().sumOf { of(it.value) }

    public val size: Int get() = walk().count()
}

/**
 * Flyweight — share one instance per key instead of re-creating equal objects.
 *
 * ```
 * val treeTypes = Flyweight<String, TreeType> { name -> TreeType(name) }
 * treeTypes["oak"] === treeTypes["oak"] // true
 * ```
 *
 * Backed by a [ConcurrentHashMap], so it is safe to share across threads and the
 * factory runs once per key even under contention.
 */
public class Flyweight<K : Any, V : Any>(private val factory: (K) -> V) {
    private val cache: ConcurrentHashMap<K, V> = ConcurrentHashMap()

    public operator fun get(key: K): V = cache.computeIfAbsent(key) { factory(it) }

    public val size: Int get() = cache.size

    public fun clear(): Unit = cache.clear()
}
