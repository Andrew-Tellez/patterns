//! The suite runs with `cargo test`, the standard-library test runner — no
//! framework, matching every other package here.

use gof_patterns::{
    chain, decorate, visitor, Answer, Bridge, Builder, Command, CommandBus, Composite, Flyweight,
    Handler, History, Layer, Mediator, Registry, Singleton, StateMachine, Subject, Wrapper,
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[test]
fn singleton_builds_once_and_resets() {
    let calls = AtomicUsize::new(0);
    let config = Singleton::new(|| {
        calls.fetch_add(1, Ordering::SeqCst);
        "MXN".to_string()
    });

    assert!(Arc::ptr_eq(&config.get(), &config.get()));
    assert_eq!(calls.load(Ordering::SeqCst), 1);

    config.reset();
    let _ = config.get();
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[test]
fn singleton_is_safe_across_threads() {
    let calls = AtomicUsize::new(0);
    let config = Singleton::new(|| {
        calls.fetch_add(1, Ordering::SeqCst);
        7_u32
    });

    std::thread::scope(|scope| {
        for _ in 0..50 {
            scope.spawn(|| assert_eq!(*config.get(), 7));
        }
    });

    assert_eq!(
        calls.load(Ordering::SeqCst),
        1,
        "the factory must run once even under contention"
    );
}

#[test]
fn registry_creates_by_key_and_names_what_it_does_not_know() {
    let mut rails: Registry<&str, Box<dyn Fn(u32) -> String>> = Registry::new();
    rails.register("stripe", Box::new(|cents| format!("stripe:{cents}")));

    assert_eq!(rails.get("stripe").unwrap()(500), "stripe:500");
    assert!(rails.has(&"stripe"));
    assert!(!rails.has(&"paypal"));
    assert_eq!(rails.len(), 1);
    assert!(!rails.is_empty());
    assert_eq!(rails.keys().count(), 1);

    // .err() rather than .unwrap_err(): the latter needs the success type to be
    // Debug, and a boxed closure is not.
    let error = rails.get("paypal").err().expect("paypal is not registered");
    assert!(
        error.to_string().contains("paypal"),
        "the error should name the key: {error}"
    );
    assert!(Registry::<&str, ()>::default().is_empty());
}

#[test]
fn builder_applies_conditional_steps() {
    #[derive(Debug, Default, PartialEq)]
    struct Query {
        table: String,
        user: Option<String>,
    }

    let query = Builder::new(Query::default())
        .with(|mut q| {
            q.table = "orders".into();
            q
        })
        .with_if(true, |mut q| {
            q.user = Some("u1".into());
            q
        })
        .with_if(false, |mut q| {
            q.table = "never".into();
            q
        })
        .build();

    assert_eq!(
        query,
        Query {
            table: "orders".into(),
            user: Some("u1".into())
        }
    );
}

#[test]
fn clone_is_the_prototype_no_helper_needed() {
    #[derive(Clone, Debug, PartialEq)]
    struct Order {
        id: String,
        cents: u32,
    }

    let original = Order {
        id: "a".into(),
        cents: 100,
    };
    let mut copy = original.clone();
    copy.cents = 200;

    assert_eq!(original.cents, 100);
    assert_eq!(copy.id, "a");
}

#[test]
fn decorate_applies_wrappers_outermost_first() {
    let order = Rc::new(RefCell::new(Vec::new()));

    let outer_log = Rc::clone(&order);
    let outer: Wrapper<u32, String> = Box::new(move |next| {
        let log = Rc::clone(&outer_log);
        Box::new(move |n| {
            log.borrow_mut().push("outer");
            next(n)
        })
    });

    let inner_log = Rc::clone(&order);
    let inner: Wrapper<u32, String> = Box::new(move |next| {
        let log = Rc::clone(&inner_log);
        Box::new(move |n| {
            log.borrow_mut().push("inner");
            next(n)
        })
    });

    let call = decorate(Box::new(|n: u32| format!("core:{n}")), vec![outer, inner]);
    assert_eq!(call(1), "core:1");
    assert_eq!(*order.borrow(), vec!["outer", "inner"]);
}

#[test]
fn decorate_with_no_wrappers_passes_through() {
    let call = decorate(Box::new(|n: u32| n + 1), vec![]);
    assert_eq!(call(1), 2);
}

#[test]
fn composite_aggregates_over_the_tree() {
    let mut root = Composite::with_children(10.0, vec![Composite::new(5.0), Composite::new(1.0)]);

    assert_eq!(root.sum(|price| *price), 16.0);
    assert_eq!(root.len(), 3);
    assert_eq!(root.children().len(), 2);

    let removed = root.remove(0).expect("child 0 exists");
    assert_eq!(removed.value, 5.0);
    assert_eq!(root.sum(|price| *price), 11.0);
    assert!(root.remove(9).is_none());
    assert!(Composite::new(1.0).is_empty());
}

#[test]
fn composite_walk_is_lazy_and_depth_first() {
    let root = Composite::with_children(
        "a",
        vec![Composite::with_children("b", vec![Composite::new("c")])],
    );

    let order: Vec<&str> = root.walk().map(|node| node.value).collect();
    assert_eq!(order, vec!["a", "b", "c"]);

    let mut visited = 0;
    let found = root
        .walk()
        .inspect(|_| visited += 1)
        .find(|node| node.value == "b");
    assert_eq!(found.map(|node| node.value), Some("b"));
    assert_eq!(visited, 2, "the walk stopped instead of reaching \"c\"");
}

#[test]
fn flyweight_shares_one_value_per_key() {
    let built = AtomicUsize::new(0);
    let types = Flyweight::new(|name: &&str| {
        built.fetch_add(1, Ordering::SeqCst);
        name.to_uppercase()
    });

    assert!(Arc::ptr_eq(&types.get("oak"), &types.get("oak")));
    assert_eq!(built.load(Ordering::SeqCst), 1);
    assert!(!Arc::ptr_eq(&types.get("oak"), &types.get("pine")));
    assert_eq!(types.len(), 2);
    assert!(!types.is_empty());

    types.clear();
    assert!(types.is_empty());
}

#[test]
fn bridge_keeps_the_reference_stable_across_a_swap() {
    let storage = Bridge::new(
        |prefix: &'static str| {
            Box::new(move |key: &str| format!("{prefix}:{key}")) as Layer<&str, String>
        },
        "s3",
    );

    let captured = &storage; // a caller that keeps the reference
    assert_eq!((captured.api())("a"), "s3:a");

    storage.swap("disk");
    assert_eq!(
        (captured.api())("a"),
        "disk:a",
        "the swap must reach a caller that already had the bridge"
    );
}

#[test]
fn chain_stops_at_the_first_handler_that_answers() {
    let route = chain(
        vec![
            Box::new(|level: &u8| (*level == 1).then(|| "bot".to_string())) as Handler<u8, String>,
            Box::new(|level: &u8| (*level == 2).then(|| "human".to_string())),
        ],
        Some(Box::new(|_: &u8| "queue".to_string())),
    );

    assert_eq!(route(&1).unwrap(), "bot");
    assert_eq!(route(&2).unwrap(), "human");
    assert_eq!(route(&9).unwrap(), "queue");

    let empty = chain::<u8, String>(vec![], None);
    let error = empty(&1).unwrap_err();
    assert!(error.to_string().contains("no fallback"));
}

#[test]
fn command_bus_undoes_and_redoes() {
    let cart = Rc::new(RefCell::new(Vec::new()));
    let mut bus = CommandBus::new();

    let added = Rc::clone(&cart);
    let removed = Rc::clone(&cart);
    bus.run(Command::new(
        move || added.borrow_mut().push("book"),
        move || {
            removed.borrow_mut().pop();
        },
    ));

    assert_eq!(*cart.borrow(), vec!["book"]);
    assert!(bus.can_undo());
    assert!(bus.undo());
    assert!(cart.borrow().is_empty());
    assert!(bus.can_redo());
    assert!(bus.redo());
    assert_eq!(*cart.borrow(), vec!["book"]);
}

#[test]
fn an_empty_bus_and_a_command_that_cannot_be_undone() {
    let mut bus = CommandBus::default();
    assert!(!bus.can_undo());
    assert!(!bus.can_redo());
    assert!(!bus.undo());
    assert!(!bus.redo());

    let ran = Rc::new(RefCell::new(false));
    let flag = Rc::clone(&ran);
    bus.run(Command::once(move || *flag.borrow_mut() = true));
    assert!(*ran.borrow());
    assert!(!bus.can_undo(), "a command with no undo is not tracked");
}

#[test]
fn subject_lets_a_listener_unsubscribe_by_dropping_its_guard() {
    let seen = Rc::new(RefCell::new(Vec::new()));
    let prices: Subject<u32> = Subject::new();

    let first = Rc::clone(&seen);
    let subscription = prices.subscribe(move |price| first.borrow_mut().push(*price));
    let second = Rc::clone(&seen);
    let kept = prices.subscribe(move |price| second.borrow_mut().push(price * 10));

    prices.emit(&1);
    assert_eq!(prices.len(), 2);
    drop(subscription);
    prices.emit(&2);

    assert_eq!(*seen.borrow(), vec![1, 10, 20]);
    assert_eq!(prices.len(), 1);
    drop(kept);
    assert!(prices.is_empty());
}

#[test]
fn a_listener_may_drop_its_own_subscription_during_emit() {
    let seen = Rc::new(RefCell::new(Vec::new()));
    let holder: Rc<RefCell<Option<gof_patterns::Subscription<u32>>>> = Rc::new(RefCell::new(None));
    let prices: Subject<u32> = Subject::new();

    let recorded = Rc::clone(&seen);
    let to_drop = Rc::clone(&holder);
    *holder.borrow_mut() = Some(prices.subscribe(move |price| {
        recorded.borrow_mut().push(*price);
        // Unsubscribing from inside the callback must not panic on a borrow.
        if let Ok(mut slot) = to_drop.try_borrow_mut() {
            slot.take();
        }
    }));

    prices.emit(&1);
    prices.emit(&2);
    assert_eq!(*seen.borrow(), vec![1], "the listener removed itself");
}

#[test]
fn mediator_keeps_typed_channels_separate() {
    let seen = Rc::new(RefCell::new(Vec::new()));
    let hub = Mediator::new();

    let logins = hub.channel::<String>("login");
    let logouts = hub.channel::<u32>("logout");

    let on_login = Rc::clone(&seen);
    let _login = logins.subscribe(move |id: &String| on_login.borrow_mut().push(id.clone()));
    let on_logout = Rc::clone(&seen);
    let logout_guard = logouts.subscribe(move |_: &u32| on_logout.borrow_mut().push("out".into()));

    logins.emit(&"u1".to_string());
    logouts.emit(&0);
    drop(logout_guard);
    logouts.emit(&0);

    assert_eq!(*seen.borrow(), vec!["u1", "out"]);
    // The same name with a different payload type is a different channel.
    assert!(!Rc::ptr_eq(
        &hub.channel::<String>("login"),
        &hub.channel::<String>("other")
    ));
}

#[test]
fn history_undoes_redoes_and_drops_the_future_on_save() {
    let mut history = History::new(String::new());
    assert!(!history.can_undo());
    assert!(!history.redo());

    history.save("a".into());
    history.save("ab".into());
    assert!(history.undo());
    assert_eq!(history.current(), "a");
    assert!(history.redo());
    assert_eq!(history.current(), "ab");

    history.undo();
    history.save("ax".into());
    assert!(!history.can_redo(), "save drops the redo future");
    assert_eq!(history.current(), "ax");
}

#[test]
fn history_honours_its_limit() {
    let mut history = History::with_limit(0_u32, 1);
    history.save(1);
    history.save(2);

    assert!(history.undo());
    assert_eq!(*history.current(), 1);
    assert!(!history.can_undo(), "the oldest state was dropped");
}

#[test]
fn state_machine_transitions_and_refuses_illegal_events() {
    let mut order = StateMachine::new(
        "draft",
        HashMap::from([
            ("draft", HashMap::from([("pay", "paid")])),
            ("paid", HashMap::from([("ship", "sent")])),
            ("sent", HashMap::new()),
        ]),
    );

    assert!(!order.can(&"ship"));
    assert_eq!(order.send("pay").unwrap(), "paid");
    assert_eq!(order.send("ship").unwrap(), "sent");

    let error = order.send("pay").unwrap_err();
    assert!(
        error.to_string().contains("sent"),
        "the error should name the refusing state: {error}"
    );
    assert_eq!(
        *order.state(),
        "sent",
        "a refused event leaves the state alone"
    );

    let audit: Vec<String> = order
        .changes()
        .iter()
        .map(|(from, to, event)| format!("{event}: {from} -> {to}"))
        .collect();
    assert_eq!(audit, vec!["pay: draft -> paid", "ship: paid -> sent"]);
}

#[test]
fn visitor_dispatches_on_a_tag_you_extract() {
    let mut visitors: HashMap<&str, Answer<HashMap<&str, f64>, f64>> = HashMap::new();
    visitors.insert(
        "square",
        Box::new(|node| node.get("side").copied().unwrap_or_default().powi(2)),
    );

    let area = visitor(|_node: &HashMap<&str, f64>| "square", visitors, None);
    assert_eq!(area(&HashMap::from([("side", 3.0)])).unwrap(), 9.0);

    let unknown = visitor(
        |_node: &u8| "hexagon",
        HashMap::<&str, Answer<u8, f64>>::new(),
        None,
    );
    let error = unknown(&0).unwrap_err();
    assert!(error.to_string().contains("hexagon"));

    let with_fallback = visitor(
        |_node: &u8| "hexagon",
        HashMap::<&str, Answer<u8, f64>>::new(),
        Some(Box::new(|_| -1.0)),
    );
    assert_eq!(with_fallback(&0).unwrap(), -1.0);
}

#[test]
fn iterator_and_template_method_are_language_features() {
    // Iterator: std::iter::from_fn wraps a cursor, no helper needed.
    let rows = ["a", "b", "c"];
    let mut index = 0;
    let cursor = std::iter::from_fn(|| {
        let row = rows.get(index)?;
        index += 1;
        Some(*row)
    });
    assert_eq!(cursor.take(2).collect::<Vec<_>>(), vec!["a", "b"]);

    // Template Method: a struct of closures whose Default fills the steps in.
    struct Report {
        read: Box<dyn Fn() -> String>,
        parse: Box<dyn Fn(String) -> Vec<String>>,
    }

    impl Default for Report {
        fn default() -> Self {
            Self {
                read: Box::new(|| "a,b".to_string()),
                parse: Box::new(|text| text.split(',').map(str::to_string).collect()),
            }
        }
    }

    let default = Report::default();
    assert_eq!((default.parse)((default.read)()), vec!["a", "b"]);

    let overridden = Report {
        read: Box::new(|| "x,y,z".to_string()),
        ..Report::default()
    };
    assert_eq!((overridden.parse)((overridden.read)()), vec!["x", "y", "z"]);
}
