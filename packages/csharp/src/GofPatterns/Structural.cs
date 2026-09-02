namespace GofPatterns;

/// <summary>
/// Composite — treat a tree of nodes like a single node.
/// <para><see cref="Walk"/> is lazy, so LINQ and an early <c>First</c> stop the traversal.</para>
/// </summary>
public sealed class Composite<T>(T value, IEnumerable<Composite<T>>? children = null)
{
    private readonly List<Composite<T>> children = children?.ToList() ?? [];

    public T Value { get; } = value;

    public IReadOnlyList<Composite<T>> Children => this.children;

    public Composite<T> Add(params Composite<T>[] nodes)
    {
        this.children.AddRange(nodes);
        return this;
    }

    public bool Remove(Composite<T> child) => this.children.Remove(child);

    /// <summary>Depth-first, self first.</summary>
    public IEnumerable<Composite<T>> Walk()
    {
        yield return this;
        foreach (var child in this.children)
        {
            foreach (var node in child.Walk())
            {
                yield return node;
            }
        }
    }

    public double Sum(Func<T, double> of) => this.Walk().Sum(node => of(node.Value));

    public int Size => this.Walk().Count();
}

/// <summary>
/// Flyweight — share one instance per key instead of re-creating equal objects.
/// <para>
/// <c>ConcurrentDictionary.GetOrAdd</c> is what this uses; the helper adds
/// <see cref="Count"/>, <see cref="Clear"/> and a name that says what the dictionary
/// is for.
/// </para>
/// </summary>
public sealed class Flyweight<TKey, TValue>(Func<TKey, TValue> factory)
    where TKey : notnull
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<TKey, TValue> cache = new();

    public TValue this[TKey key] => this.cache.GetOrAdd(key, factory);

    public int Count => this.cache.Count;

    public void Clear() => this.cache.Clear();
}

/// <summary>
/// Bridge — a stable abstraction whose implementation can be swapped underneath it.
/// <para>
/// Callers hold the bridge and read <see cref="Api"/> per call, so a
/// <see cref="Swap"/> reaches everyone who already has the reference. Constructor
/// injection — the textbook version — makes every holder re-wire instead.
/// </para>
/// </summary>
public sealed class Bridge<TImpl, TApi>(Func<TImpl, TApi> build, TImpl implementation)
{
    public TApi Api { get; private set; } = build(implementation);

    public void Swap(TImpl next) => this.Api = build(next);
}

/// <summary>
/// Decorator — wrap a function in layers (retry, cache, log) without touching it.
/// The first wrapper is the outermost, so the arguments read in the order they run.
/// </summary>
public static class Decorator
{
    public static Func<TIn, TOut> Decorate<TIn, TOut>(
        Func<TIn, TOut> fn,
        params Func<Func<TIn, TOut>, Func<TIn, TOut>>[] wrappers)
    {
        var wrapped = fn;
        for (var i = wrappers.Length - 1; i >= 0; i--)
        {
            wrapped = wrappers[i](wrapped);
        }

        return wrapped;
    }
}

/// <summary>
/// Adapter — expose an incompatible object through the interface you want.
/// <para>
/// Thin on purpose: in C# the idiomatic adapter is a small class implementing your
/// interface, and you should usually write that. This exists so the catalog reads the
/// same across languages, and to name the intent at a call site where a lambda is enough.
/// </para>
/// </summary>
public static class Adapter
{
    public static TApi Adapt<TSource, TApi>(TSource source, Func<TSource, TApi> build) => build(source);
}

// Facade has no helper in C#, and the first attempt at one proved why: a helper that
// takes a "parts" object has to construct it to pass it in, which defeats the point.
// The language already does this properly — a class whose subsystems are Lazy<T>
// fields, each built on first read:
//
//     sealed class Checkout
//     {
//         private readonly Lazy<PaymentClient> payments = new(() => new PaymentClient(key));
//         private readonly Lazy<Mailer> mail = new(() => new Mailer(smtp));
//
//         public string Pay(int cents) => this.payments.Value.Charge(cents);
//         public string Receipt(string to) => this.mail.Value.Send(to);
//     }
//
// Nothing a helper could add. See the README table.
