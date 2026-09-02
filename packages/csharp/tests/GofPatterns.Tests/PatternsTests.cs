using GofPatterns;
using static GofPatterns.Decorator;
using static GofPatterns.Iterator;

namespace GofPatterns.Tests;

[TestClass]
public class CreationalTests
{
    [TestMethod]
    public void SingletonBuildsOnceAndResets()
    {
        var calls = 0;
        var db = new Singleton<object>(() => { calls++; return new object(); });

        Assert.AreSame(db.Value, db.Value);
        Assert.AreEqual(1, calls);
        db.Reset();
        _ = db.Value;
        Assert.AreEqual(2, calls);
    }

    [TestMethod]
    public void RegistryCreatesByKeyAndNamesTheKeyItDoesNotKnow()
    {
        var rails = new Registry<string, Func<int, string>>();
        rails.Register("stripe", cents => $"stripe:{cents}");

        Assert.AreEqual("stripe:500", rails["stripe"](500));
        Assert.IsTrue(rails.Contains("stripe"));
        Assert.IsFalse(rails.Contains("paypal"));
        CollectionAssert.AreEqual(new[] { "stripe" }, rails.Keys.ToArray());

        var error = Assert.ThrowsExactly<KeyNotFoundException>(() => rails["paypal"]);
        StringAssert.Contains(error.Message, "paypal");
    }

    [TestMethod]
    public void BuilderAppliesConditionalSteps()
    {
        var query = new Builder<Query>(new Query())
            .With(q => q with { Table = "orders" })
            .WithIf(condition: true, q => q with { User = "u1" })
            .WithIf(condition: false, q => q with { Limit = 10 })
            .Build();

        Assert.AreEqual(new Query("orders", "u1", null), query);
    }

    [TestMethod]
    public void PrototypeClonesDeeply()
    {
        var original = new Box(new Inner(1));
        var copy = Prototype.Clone(original);

        copy.Inner.Value = 2;
        Assert.AreEqual(1, original.Inner.Value);
    }

    private record Query(string? Table = null, string? User = null, int? Limit = null);

    private sealed class Inner
    {
        public Inner() { }

        public Inner(int value) => this.Value = value;

        public int Value { get; set; }
    }

    private sealed class Box
    {
        public Box() => this.Inner = new Inner();

        public Box(Inner inner) => this.Inner = inner;

        public Inner Inner { get; set; }
    }
}

[TestClass]
public class StructuralTests
{
    [TestMethod]
    public void CompositeAggregatesOverTheTree()
    {
        var child = new Composite<double>(5.0);
        var root = new Composite<double>(10.0, [child, new Composite<double>(1.0)]);

        Assert.AreEqual(16.0, root.Sum(value => value));
        Assert.AreEqual(3, root.Size);
        Assert.IsTrue(root.Remove(child));
        Assert.AreEqual(11.0, root.Sum(value => value));
        Assert.IsFalse(root.Remove(child));
    }

    [TestMethod]
    public void CompositeWalkIsLazyAndDepthFirst()
    {
        var root = new Composite<string>("a", [new Composite<string>("b", [new Composite<string>("c")])]);
        CollectionAssert.AreEqual(new[] { "a", "b", "c" }, root.Walk().Select(n => n.Value).ToArray());

        var visited = 0;
        var found = root.Walk().Select(n => { visited++; return n; }).First(n => n.Value == "b");
        Assert.AreEqual("b", found.Value);
        Assert.AreEqual(2, visited); // stopped early, never reached "c"
    }

    [TestMethod]
    public void CompositeAddIsChainable()
    {
        var root = new Composite<string>("a");
        Assert.AreEqual(0, root.Children.Count);
        Assert.AreSame(root, root.Add(new Composite<string>("b"), new Composite<string>("c")));
        Assert.AreEqual(2, root.Children.Count);
    }

    [TestMethod]
    public void FlyweightSharesOneInstancePerKey()
    {
        var built = 0;
        var types = new Flyweight<string, string[]>(name => { built++; return [name]; });

        Assert.AreSame(types["oak"], types["oak"]);
        Assert.AreEqual(1, built);
        Assert.AreEqual(2, new[] { types["oak"], types["pine"] }.Length);
        Assert.AreEqual(2, types.Count);
        types.Clear();
        Assert.AreEqual(0, types.Count);
    }

    [TestMethod]
    public void BridgeKeepsTheReferenceStableAcrossASwap()
    {
        var bridge = new Bridge<Func<string, string>, Store>(
            impl => new Store(impl),
            key => $"s3:{key}");

        var captured = bridge; // a caller that holds the reference forever
        Assert.AreEqual("s3:a", captured.Api.Save("a"));
        bridge.Swap(key => $"disk:{key}");
        Assert.AreEqual("disk:a", captured.Api.Save("a"));
    }

    [TestMethod]
    public void DecorateAppliesWrappersOutermostFirst()
    {
        var order = new List<string>();
        var call = Decorate<int, string>(
            n => $"core:{n}",
            next => n => { order.Add("outer"); return next(n); },
            next => n => { order.Add("inner"); return next(n); });

        Assert.AreEqual("core:1", call(1));
        CollectionAssert.AreEqual(new[] { "outer", "inner" }, order);
    }

    [TestMethod]
    public void DecorateWithNoWrappersReturnsTheFunction()
    {
        Func<int, int> fn = n => n;
        Assert.AreSame(fn, Decorate(fn));
    }

    [TestMethod]
    public void AdaptExposesTheWantedInterface()
    {
        var legacy = new Legacy();
        var api = Adapter.Adapt(legacy, l => new Func<string, string>(l.SendMessage));
        Assert.AreEqual("sent:hi", api("hi"));
    }

    [TestMethod]
    public void LazyIsTheFacadeAndTheProxy()
    {
        var built = 0;
        var part = new Lazy<string>(() => { built++; return "built"; });

        Assert.AreEqual(0, built);
        Assert.AreEqual("built", part.Value);
        Assert.AreEqual("built", part.Value);
        Assert.AreEqual(1, built);
    }

    private sealed class Store(Func<string, string> impl)
    {
        public string Save(string key) => impl(key);
    }

    private sealed class Legacy
    {
        public string SendMessage(string message) => $"sent:{message}";
    }
}

[TestClass]
public class BehavioralTests
{
    [TestMethod]
    public void ChainStopsAtTheFirstHandlerThatAnswers()
    {
        var route = Chain.Of<int, string>(
            [
                (level, next) => level == 1 ? "bot" : next(),
                (level, next) => level == 2 ? "human" : next(),
            ],
            fallback: _ => "queue");

        Assert.AreEqual("bot", route(1));
        Assert.AreEqual("human", route(2));
        Assert.AreEqual("queue", route(9));

        var error = Assert.ThrowsExactly<InvalidOperationException>(
            () => Chain.Of<int, string>([])(1));
        StringAssert.Contains(error.Message, "no fallback");
    }

    [TestMethod]
    public void CommandBusUndoesAndRedoes()
    {
        var cart = new List<string>();
        var bus = new CommandBus();

        bool Add(string sku) => bus.Run(new Command<bool>(
            () => { cart.Add(sku); return true; },
            undo: () => cart.Remove(sku)));

        Add("book");
        Add("mug");
        CollectionAssert.AreEqual(new[] { "book", "mug" }, cart);
        Assert.IsTrue(bus.Undo());
        CollectionAssert.AreEqual(new[] { "book" }, cart);
        Assert.IsTrue(bus.Redo());
        CollectionAssert.AreEqual(new[] { "book", "mug" }, cart);
        Assert.IsFalse(bus.CanRedo);
    }

    [TestMethod]
    public void EmptyStacksAndTheFlagsThatReportThem()
    {
        var bus = new CommandBus();
        Assert.IsFalse(bus.CanUndo);
        Assert.IsFalse(bus.CanRedo);
        Assert.IsFalse(bus.Undo());
        Assert.IsFalse(bus.Redo());
    }

    [TestMethod]
    public void ACommandWithNoUndoRunsButIsNotTracked()
    {
        var bus = new CommandBus();
        Assert.AreEqual(42, bus.Run(new Command<int>(() => 42)));
        Assert.IsFalse(bus.CanUndo);
    }

    [TestMethod]
    public void SubjectAllowsUnsubscribingDuringEmit()
    {
        var seen = new List<int>();
        var subject = new Subject<int>();
        IDisposable? subscription = null;
        subscription = subject.Subscribe(n => { seen.Add(n); subscription!.Dispose(); });
        subject.Subscribe(n => seen.Add(n * 10));

        subject.Emit(1);
        subject.Emit(2);
        CollectionAssert.AreEqual(new[] { 1, 10, 20 }, seen);
        Assert.AreEqual(1, subject.Count);
    }

    [TestMethod]
    public void DisposingASubscriptionTwiceIsHarmless()
    {
        var subject = new Subject<int>();
        var subscription = subject.Subscribe(_ => { });
        subscription.Dispose();
        subscription.Dispose();
        Assert.AreEqual(0, subject.Count);
    }

    [TestMethod]
    public void MediatorKeepsTypedChannelsSeparate()
    {
        var login = new Mediator.Channel<string>("login");
        var logout = new Mediator.Channel<int>("logout");
        var hub = new Mediator();
        var seen = new List<string>();

        hub.On(login, id => seen.Add(id));
        var subscription = hub.On(logout, _ => seen.Add("out"));

        hub.Emit(login, "u1");
        hub.Emit(logout, 0);
        subscription.Dispose();
        hub.Emit(logout, 0);

        CollectionAssert.AreEqual(new[] { "u1", "out" }, seen);
        Assert.AreEqual("login", login.Name);
    }

    [TestMethod]
    public void HistoryUndoesRedoesAndDropsTheFutureOnSave()
    {
        var history = new History<string>("");
        Assert.IsFalse(history.CanUndo);
        Assert.IsFalse(history.Redo());

        history.Save("a");
        history.Save("ab");
        Assert.IsTrue(history.Undo());
        Assert.AreEqual("a", history.Current);
        Assert.IsTrue(history.Redo());
        Assert.AreEqual("ab", history.Current);

        history.Undo();
        history.Save("ax");
        Assert.IsFalse(history.CanRedo);
        Assert.AreEqual("ax", history.Current);
    }

    [TestMethod]
    public void HistoryHonoursTheLimitAndTheSnapshot()
    {
        var limited = new History<int>(0, limit: 1);
        limited.Save(1);
        limited.Save(2);
        Assert.IsTrue(limited.Undo());
        Assert.AreEqual(1, limited.Current);
        Assert.IsFalse(limited.CanUndo);

        var mutable = new List<string> { "" };
        var deep = new History<List<string>>(mutable, snapshot: value => [.. value]);
        deep.Save(mutable);
        mutable[0] = "mutated";
        deep.Undo();
        CollectionAssert.AreEqual(new[] { "" }, deep.Current);
    }

    [TestMethod]
    public void StateMachineTransitionsAndRefusesIllegalEvents()
    {
        var order = new StateMachine<string, string>("draft", new Dictionary<string, Dictionary<string, string>>
        {
            ["draft"] = new() { ["pay"] = "paid" },
            ["paid"] = new() { ["ship"] = "sent" },
            ["sent"] = [],
        });

        var audit = new List<string>();
        order.Changes.Subscribe(change => audit.Add($"{change.Event}: {change.From} -> {change.To}"));

        Assert.IsFalse(order.Can("ship"));
        Assert.AreEqual("paid", order.Send("pay"));
        Assert.AreEqual("sent", order.Send("ship"));
        CollectionAssert.AreEqual(new[] { "pay: draft -> paid", "ship: paid -> sent" }, audit);

        var error = Assert.ThrowsExactly<InvalidOperationException>(() => order.Send("pay"));
        StringAssert.Contains(error.Message, "not allowed in \"sent\"");
    }

    [TestMethod]
    public void StateMachineWorksWithAnEnumSoSwitchStaysExhaustive()
    {
        var machine = new StateMachine<Status, string>(Status.Draft, new Dictionary<Status, Dictionary<string, Status>>
        {
            [Status.Draft] = new() { ["pay"] = Status.Paid },
            [Status.Paid] = [],
        });

        Assert.AreEqual(Status.Paid, machine.Send("pay"));
        Assert.IsFalse(machine.Can("pay"));
    }

    [TestMethod]
    public void VisitorDispatchesOnATagYouExtract()
    {
        var area = Visitor.On<Dictionary<string, object>, string, double>(
            node => (string)node["type"],
            new Dictionary<string, Func<Dictionary<string, object>, double>>
            {
                ["square"] = node => Math.Pow((double)node["side"], 2),
                ["circle"] = node => Math.PI * Math.Pow((double)node["r"], 2),
            });

        Assert.AreEqual(9.0, area(new() { ["type"] = "square", ["side"] = 3.0 }));

        var error = Assert.ThrowsExactly<KeyNotFoundException>(
            () => area(new() { ["type"] = "hexagon" }));
        StringAssert.Contains(error.Message, "hexagon");

        var withFallback = Visitor.On<Dictionary<string, object>, string, double>(
            node => (string)node["type"],
            new Dictionary<string, Func<Dictionary<string, object>, double>>(),
            fallback: _ => -1);
        Assert.AreEqual(-1.0, withFallback(new() { ["type"] = "x" }));
    }

    [TestMethod]
    public void IterateWalksAnExternalCursorLazily()
    {
        var rows = new[] { "a", "b", "c" };
        var i = 0;

        var pulled = new List<string>();
        foreach (var row in Iterate(() => i < rows.Length, () => { pulled.Add(rows[i]); return rows[i++]; }))
        {
            if (row == "b")
            {
                break;
            }
        }

        CollectionAssert.AreEqual(new[] { "a", "b" }, pulled); // never pulled "c"

        i = 0;
        pulled.Clear();
        CollectionAssert.AreEqual(rows, Iterate(() => i < rows.Length, () => rows[i++]).ToArray());
    }

    [TestMethod]
    public void TemplateReplacesTheSteps()
    {
        var hooks = new Hooks(() => "a,b", text => text.Split(','));
        var run = Template.Of<Hooks, string, string[]>(hooks, (h, _) => h.Parse(h.Read()));
        CollectionAssert.AreEqual(new[] { "a", "b" }, run("ignored"));

        var overridden = Template.Of<Hooks, string, string[]>(
            hooks,
            (h, _) => h.Parse(h.Read()),
            overrides: new Hooks(() => "x,y,z", text => text.Split(',')));
        CollectionAssert.AreEqual(new[] { "x", "y", "z" }, overridden("ignored"));
    }

    private enum Status { Draft, Paid }

    private sealed record Hooks(Func<string> Read, Func<string, string[]> Parse);
}
