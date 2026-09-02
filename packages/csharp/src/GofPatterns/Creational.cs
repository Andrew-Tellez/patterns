using System.Text.Json;

namespace GofPatterns;

/// <summary>
/// Singleton — one lazily created instance, shared.
/// <para>
/// <c>Lazy&lt;T&gt;</c> does the same and is thread-safe; prefer it unless you need
/// <see cref="Reset"/>, which exists so a test can drop the instance.
/// </para>
/// </summary>
public sealed class Singleton<T>(Func<T> factory)
{
    private readonly object gate = new();
    private T? instance;
    private bool built;

    public T Value
    {
        get
        {
            lock (this.gate)
            {
                if (!this.built)
                {
                    this.instance = factory();
                    this.built = true;
                }

                return this.instance!;
            }
        }
    }

    /// <summary>Drops the instance, so the next read builds a new one.</summary>
    public void Reset()
    {
        lock (this.gate)
        {
            this.instance = default;
            this.built = false;
        }
    }
}

/// <summary>
/// Factory Method / Abstract Factory / Strategy — factories keyed by name. The
/// registered value is a delegate type you choose, so the call stays type-safe.
/// <code>
/// var rails = new Registry&lt;string, Func&lt;int, string&gt;&gt;();
/// rails.Register("stripe", cents =&gt; $"stripe:{cents}");
/// rails["stripe"](500);
/// </code>
/// </summary>
public sealed class Registry<TKey, TFactory>
    where TKey : notnull
    where TFactory : Delegate
{
    private readonly Dictionary<TKey, TFactory> factories = [];

    /// <summary>Returns the factory, so a registration can be kept in a field.</summary>
    public TFactory Register(TKey key, TFactory factory) => this.factories[key] = factory;

    /// <summary>Throws <see cref="KeyNotFoundException"/> naming the key.</summary>
    public TFactory this[TKey key] =>
        this.factories.TryGetValue(key, out var factory)
            ? factory
            : throw new KeyNotFoundException($"Registry: nothing registered for \"{key}\"");

    public bool Contains(TKey key) => this.factories.ContainsKey(key);

    public IReadOnlyCollection<TKey> Keys => this.factories.Keys;
}

/// <summary>
/// Builder — step-by-step construction, for when it is spread across branches.
/// <para>
/// Object initializers and named arguments cover the case where the call site knows
/// every field; prefer those. <see cref="WithIf"/> is what this adds — a query or a
/// request assembled from optional filters, which reads badly as an initializer.
/// </para>
/// <code>
/// var query = new Builder&lt;Query&gt;(new Query())
///     .WithIf(user is not null, q =&gt; q with { User = user })
///     .Build();
/// </code>
/// </summary>
public sealed class Builder<T>(T draft)
{
    private T draft = draft;

    public Builder<T> With(Func<T, T> change)
    {
        this.draft = change(this.draft);
        return this;
    }

    /// <summary>Applies the change only when <paramref name="condition"/> holds.</summary>
    public Builder<T> WithIf(bool condition, Func<T, T> change) =>
        condition ? this.With(change) : this;

    public T Build() => this.draft;
}

/// <summary>
/// Prototype — a new object copied from an existing one.
/// <para>
/// A <c>record</c> with a <c>with</c> expression is the idiomatic shallow copy, and you
/// should prefer it. <see cref="Clone"/> is a deep copy done by a JSON round-trip: the
/// type has to be serialisable, and anything JSON cannot carry is dropped — delegates,
/// streams, cyclic references.
/// </para>
/// </summary>
public static class Prototype
{
    public static T Clone<T>(T value) =>
        JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value))
            ?? throw new InvalidOperationException("Prototype.Clone: the copy deserialised to null.");
}
