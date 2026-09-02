namespace GofPatterns;

/// <summary>
/// Chain of Responsibility — each handler either answers or calls <c>next()</c>.
/// <code>
/// var route = Chain.Of&lt;Ticket, string&gt;(
///     [(t, next) =&gt; t.Level == 1 ? "bot" : next(),
///      (t, next) =&gt; t.Paid ? "human" : next()],
///     fallback: _ =&gt; "queue");
/// </code>
/// </summary>
public static class Chain
{
    public static Func<TReq, TRes> Of<TReq, TRes>(
        IReadOnlyList<Func<TReq, Func<TRes>, TRes>> handlers,
        Func<TReq, TRes>? fallback = null)
    {
        return request =>
        {
            TRes Step(int i) =>
                i >= handlers.Count
                    ? fallback is not null
                        ? fallback(request)
                        : throw new InvalidOperationException(
                            "Chain: no handler answered and no fallback was given")
                    : handlers[i](request, () => Step(i + 1));

            return Step(0);
        };
    }
}

/// <summary>A command from two delegates, so the simple case needs no class.</summary>
public sealed class Command<T>(Func<T> execute, Action? undo = null)
{
    public Action? Undo { get; } = undo;

    public T Execute() => execute();
}

/// <summary>
/// Command — undoable operations with history. A command with no undo still runs, but
/// cannot be undone.
/// </summary>
public sealed class CommandBus
{
    private readonly Stack<(Func<object?> Execute, Action Undo)> done = new();
    private readonly Stack<(Func<object?> Execute, Action Undo)> undone = new();

    public T Run<T>(Command<T> command)
    {
        var result = command.Execute();
        this.undone.Clear();
        if (command.Undo is { } undo)
        {
            this.done.Push((() => command.Execute(), undo));
        }

        return result;
    }

    public bool Undo()
    {
        if (!this.done.TryPop(out var entry))
        {
            return false;
        }

        entry.Undo();
        this.undone.Push(entry);
        return true;
    }

    public bool Redo()
    {
        if (!this.undone.TryPop(out var entry))
        {
            return false;
        }

        entry.Execute();
        this.done.Push(entry);
        return true;
    }

    public bool CanUndo => this.done.Count > 0;

    public bool CanRedo => this.undone.Count > 0;
}

/// <summary>
/// Observer — one typed channel. <see cref="Subscribe"/> returns an
/// <see cref="IDisposable"/>, so <c>using</c> scopes a subscription.
/// <para><c>event</c> is the language's own answer and is fine; this adds disposable
/// unsubscription and a value you can pass around.</para>
/// </summary>
public sealed class Subject<T>
{
    private readonly List<Action<T>> listeners = [];

    public IDisposable Subscribe(Action<T> listener)
    {
        this.listeners.Add(listener);
        return new Subscription(() => this.listeners.Remove(listener));
    }

    public void Emit(T value)
    {
        // Iterate a copy: a listener may unsubscribe during Emit.
        foreach (var listener in this.listeners.ToArray())
        {
            listener(value);
        }
    }

    public int Count => this.listeners.Count;

    private sealed class Subscription(Action dispose) : IDisposable
    {
        private bool disposed;

        public void Dispose()
        {
            if (!this.disposed)
            {
                this.disposed = true;
                dispose();
            }
        }
    }
}

/// <summary>
/// Mediator — components talk to a hub, never to each other. Channels carry their
/// payload type, so a listener cannot be attached to the wrong event.
/// <code>
/// var invoicePaid = new Mediator.Channel&lt;Invoice&gt;("invoice.paid");
/// hub.On(invoicePaid, invoice =&gt; mailer.Send(invoice.Id));
/// hub.Emit(invoicePaid, invoice);
/// </code>
/// </summary>
public sealed class Mediator
{
    private readonly Dictionary<object, object> subjects = [];

    /// <summary>A named, typed event. The name is only for debugging.</summary>
    public sealed class Channel<T>(string name)
    {
        public string Name { get; } = name;
    }

    private Subject<T> SubjectFor<T>(Channel<T> channel)
    {
        if (!this.subjects.TryGetValue(channel, out var subject))
        {
            subject = new Subject<T>();
            this.subjects[channel] = subject;
        }

        return (Subject<T>)subject;
    }

    public IDisposable On<T>(Channel<T> channel, Action<T> listener) =>
        this.SubjectFor(channel).Subscribe(listener);

    public void Emit<T>(Channel<T> channel, T payload) => this.SubjectFor(channel).Emit(payload);
}

/// <summary>
/// Memento — undo/redo over snapshots of state.
/// <para>Snapshots are stored by reference. Pass <c>snapshot</c> when the state is
/// mutated in place; with a <c>record</c>, a <c>with</c> expression is already a copy.</para>
/// </summary>
public sealed class History<T>(T initial, int limit = int.MaxValue, Func<T, T>? snapshot = null)
{
    private readonly Func<T, T> snapshot = snapshot ?? (value => value);
    private readonly LinkedList<T> past = new();
    private readonly Stack<T> future = new();

    public T Current { get; private set; } = (snapshot ?? (value => value))(initial);

    public void Save(T state)
    {
        this.past.AddLast(this.Current);
        if (this.past.Count > limit)
        {
            this.past.RemoveFirst();
        }

        this.future.Clear();
        this.Current = this.snapshot(state);
    }

    public bool Undo()
    {
        if (this.past.Last is null)
        {
            return false;
        }

        this.future.Push(this.Current);
        this.Current = this.past.Last.Value;
        this.past.RemoveLast();
        return true;
    }

    public bool Redo()
    {
        if (!this.future.TryPop(out var next))
        {
            return false;
        }

        this.past.AddLast(this.Current);
        this.Current = next;
        return true;
    }

    public bool CanUndo => this.past.Count > 0;

    public bool CanRedo => this.future.Count > 0;
}

/// <summary>
/// State — a finite state machine from a transition table.
/// <code>
/// var order = new StateMachine&lt;string, string&gt;("draft", new()
/// {
///     ["draft"] = new() { ["pay"] = "paid" },
///     ["paid"] = new() { ["ship"] = "sent" },
///     ["sent"] = [],
/// });
/// order.Send("pay");  // "paid"
/// </code>
/// <para>States and events are type parameters, so an <c>enum</c> works and a
/// <c>switch</c> over it stays exhaustive.</para>
/// </summary>
public sealed class StateMachine<TState, TEvent>(
    TState initial,
    IReadOnlyDictionary<TState, Dictionary<TEvent, TState>> transitions)
    where TState : notnull
    where TEvent : notnull
{
    public TState State { get; private set; } = initial;

    /// <summary>Emits the state before, the state after, and the event that caused it.</summary>
    public Subject<(TState From, TState To, TEvent Event)> Changes { get; } = new();

    public bool Can(TEvent @event) =>
        transitions.TryGetValue(this.State, out var allowed) && allowed.ContainsKey(@event);

    /// <summary>Returns the new state. Throws on an event the current state disallows.</summary>
    public TState Send(TEvent @event)
    {
        if (!transitions.TryGetValue(this.State, out var allowed)
            || !allowed.TryGetValue(@event, out var target))
        {
            throw new InvalidOperationException(
                $"StateMachine: \"{@event}\" is not allowed in \"{this.State}\"");
        }

        var from = this.State;
        this.State = target;
        this.Changes.Emit((from, target, @event));
        return target;
    }
}

/// <summary>
/// Visitor — dispatch on a node's tag instead of a switch in every function.
/// <para>
/// Pattern matching on a type hierarchy is better when your nodes are classes, and the
/// compiler checks it — prefer that. This dispatches on a value you extract, which is
/// what you need for a <c>JsonNode</c> or a dictionary that never became a class.
/// </para>
/// </summary>
public static class Visitor
{
    public static Func<TNode, TResult> On<TNode, TTag, TResult>(
        Func<TNode, TTag> tag,
        IReadOnlyDictionary<TTag, Func<TNode, TResult>> visitors,
        Func<TNode, TResult>? fallback = null)
        where TTag : notnull
    {
        return node =>
        {
            var key = tag(node);
            if (visitors.TryGetValue(key, out var visit))
            {
                return visit(node);
            }

            return fallback is not null
                ? fallback(node)
                : throw new KeyNotFoundException($"Visitor: no visitor for \"{key}\"");
        };
    }
}

/// <summary>
/// Iterator — turn an external cursor into something <c>foreach</c> and LINQ can walk.
/// <para>
/// Drivers and SDKs hand you a <c>HasNext()</c> / <c>Next()</c> pair. This is lazy, so
/// a <c>break</c> or a <c>First</c> stops pulling. Writing the source yourself? Use
/// <c>yield return</c> — no helper needed.
/// </para>
/// </summary>
public static class Iterator
{
    public static IEnumerable<T> Iterate<T>(Func<bool> hasNext, Func<T> next)
    {
        while (hasNext())
        {
            yield return next();
        }
    }
}

/// <summary>
/// Template Method — a fixed skeleton with replaceable steps.
/// <para>
/// Optional parameters with delegate defaults are the idiomatic version and you should
/// prefer them: <c>Report(Func&lt;string&gt;? read = null)</c>. This exists so the
/// catalog reads the same across languages.
/// </para>
/// </summary>
public static class Template
{
    public static Func<TArg, TResult> Of<THooks, TArg, TResult>(
        THooks defaults,
        Func<THooks, TArg, TResult> skeleton,
        THooks? overrides = null)
        where THooks : class =>
        arg => skeleton(overrides ?? defaults, arg);
}
