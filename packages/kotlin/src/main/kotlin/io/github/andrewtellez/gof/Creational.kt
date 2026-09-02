package io.github.andrewtellez.gof

/**
 * Factory Method / Abstract Factory / Strategy — factories keyed by name.
 *
 * The registered value is a function type you choose, so the call signature stays
 * type-safe instead of collapsing to `Any`:
 *
 * ```
 * val rails = Registry<String, (Int) -> Rail>()
 * rails.register("stripe") { cents -> StripeRail(cents) }
 * rails["stripe"](1999)
 * ```
 *
 * Four of the five creational patterns need no helper in Kotlin — `object` is a
 * Singleton, `data class` + `copy()` is a Prototype, and default and named arguments
 * are a Builder. See the README table.
 */
public class Registry<K, F : Any>(vararg entries: Pair<K, F>) {
    private val factories: MutableMap<K, F> = entries.toMap().toMutableMap()

    /** Returns the factory, so registration can be chained or kept in a `val`. */
    public fun register(key: K, factory: F): F {
        factories[key] = factory
        return factory
    }

    /** Throws [NoSuchElementException] naming the key, rather than returning null. */
    public operator fun get(key: K): F =
        factories[key] ?: throw NoSuchElementException("Registry: nothing registered for \"$key\"")

    public operator fun contains(key: K): Boolean = key in factories

    public val keys: Set<K> get() = factories.keys
}
