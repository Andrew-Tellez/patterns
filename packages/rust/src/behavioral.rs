//! Behavioral patterns.
//!
//! Two ship no helper:
//!
//! - **Iterator** — the [`Iterator`] trait, and [`std::iter::from_fn`] when you
//!   have a cursor rather than a collection.
//! - **Template Method** — a struct of closure fields with a [`Default`] impl. The
//!   constructor filling the defaults *is* the pattern.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fmt;
use std::hash::Hash;
use std::rc::{Rc, Weak};

/// One link of a [`chain`]: `Some` answers, `None` passes the turn.
pub type Handler<Req, Res> = Box<dyn Fn(&Req) -> Option<Res>>;

/// The answer of last resort for a [`chain`], and the visitor of last resort for
/// [`visitor`].
pub type Answer<Req, Res> = Box<dyn Fn(&Req) -> Res>;

/// Returned by a [`chain`] whose handlers all declined and that had no fallback.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChainError;

impl fmt::Display for ChainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("gof: no handler answered and no fallback was given")
    }
}

impl std::error::Error for ChainError {}

/// Chain of Responsibility — the handlers are tried in order; the first to return
/// `Some` answers.
///
/// **This is the one helper whose shape changed for Rust.** Everywhere else a
/// handler takes a `next` callback; here it returns [`Option`]. A recursive `next`
/// closure fights the borrow checker for nothing, and `None` says "not mine" more
/// plainly than calling a function whose only job is to move on.
///
/// ```
/// use gof_patterns::chain;
///
/// let route = chain(
///     vec![
///         Box::new(|level: &u8| (*level == 1).then(|| "bot".to_string())) as gof_patterns::Handler<u8, String>,
///         Box::new(|level: &u8| (*level == 2).then(|| "human".to_string())),
///     ],
///     Some(Box::new(|_: &u8| "queue".to_string())),
/// );
///
/// assert_eq!(route(&1).unwrap(), "bot");
/// assert_eq!(route(&9).unwrap(), "queue");
/// ```
pub fn chain<Req, Res>(
    handlers: Vec<Handler<Req, Res>>,
    fallback: Option<Answer<Req, Res>>,
) -> impl Fn(&Req) -> Result<Res, ChainError> {
    move |request| {
        for handler in &handlers {
            if let Some(answer) = handler(request) {
                return Ok(answer);
            }
        }
        fallback
            .as_ref()
            .map(|last| last(request))
            .ok_or(ChainError)
    }
}

/// One undoable operation, built from two closures.
///
/// A command with no `undo` still runs, but is not tracked. Closures that mutate
/// state need to own it — `Rc<RefCell<_>>` or a channel — which is Rust making the
/// shared mutation visible rather than letting it hide in a callback.
pub struct Command {
    /// Runs the operation.
    pub execute: Box<dyn Fn()>,
    /// Reverses it, when that is possible.
    pub undo: Option<Box<dyn Fn()>>,
}

impl Command {
    /// A command that can be undone.
    pub fn new(execute: impl Fn() + 'static, undo: impl Fn() + 'static) -> Self {
        Self {
            execute: Box::new(execute),
            undo: Some(Box::new(undo)),
        }
    }

    /// A command that runs but cannot be undone.
    pub fn once(execute: impl Fn() + 'static) -> Self {
        Self {
            execute: Box::new(execute),
            undo: None,
        }
    }
}

/// Command — runs commands and keeps the undo and redo history.
#[derive(Default)]
pub struct CommandBus {
    done: Vec<Command>,
    undone: Vec<Command>,
}

impl CommandBus {
    /// An empty bus.
    pub fn new() -> Self {
        Self::default()
    }

    /// Runs `command`, and records it if it can be undone.
    pub fn run(&mut self, command: Command) {
        (command.execute)();
        self.undone.clear();
        if command.undo.is_some() {
            self.done.push(command);
        }
    }

    /// Reverses the last undoable command, reporting whether there was one.
    pub fn undo(&mut self) -> bool {
        match self.done.pop() {
            Some(command) => {
                if let Some(undo) = &command.undo {
                    undo();
                }
                self.undone.push(command);
                true
            }
            None => false,
        }
    }

    /// Re-runs the last undone command, reporting whether there was one.
    pub fn redo(&mut self) -> bool {
        match self.undone.pop() {
            Some(command) => {
                (command.execute)();
                self.done.push(command);
                true
            }
            None => false,
        }
    }

    /// Whether there is anything to undo.
    pub fn can_undo(&self) -> bool {
        !self.done.is_empty()
    }

    /// Whether there is anything to redo.
    pub fn can_redo(&self) -> bool {
        !self.undone.is_empty()
    }
}

/// One listener, shared so `emit` can call it after releasing the borrow.
type Listener<T> = Rc<dyn Fn(&T)>;
type Registered<T> = Vec<(usize, Listener<T>)>;
type Listeners<T> = Rc<RefCell<Registered<T>>>;

/// Holds a subscription open. Dropping it unsubscribes.
///
/// This is the Rust answer to "how do I stop listening": a guard whose lifetime
/// *is* the subscription, rather than a function you have to remember to call.
pub struct Subscription<T> {
    id: usize,
    listeners: Weak<RefCell<Registered<T>>>,
}

impl<T> Drop for Subscription<T> {
    fn drop(&mut self) {
        if let Some(listeners) = self.listeners.upgrade() {
            listeners.borrow_mut().retain(|(id, _)| *id != self.id);
        }
    }
}

/// Observer — one typed channel of values.
///
/// Listeners are `'static`, which is Rust being honest rather than restrictive: a
/// callback stored in a collection outlives the statement that created it, so it
/// cannot borrow a local. Share what it needs to touch — the `Rc<RefCell<_>>`
/// below is the usual way, and it makes the shared mutation visible instead of
/// hiding it inside a closure.
///
/// ```
/// use gof_patterns::Subject;
/// use std::cell::RefCell;
/// use std::rc::Rc;
///
/// let seen = Rc::new(RefCell::new(Vec::new()));
/// let prices = Subject::new();
///
/// let recorded = Rc::clone(&seen);
/// let subscription = prices.subscribe(move |price: &u32| recorded.borrow_mut().push(*price));
///
/// prices.emit(&99);
/// drop(subscription);   // unsubscribed
/// prices.emit(&1);
///
/// assert_eq!(*seen.borrow(), vec![99]);
/// ```
pub struct Subject<T> {
    listeners: Listeners<T>,
    next_id: RefCell<usize>,
}

impl<T> Default for Subject<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T> Subject<T> {
    /// A channel with no listeners.
    pub fn new() -> Self {
        Self {
            listeners: Rc::new(RefCell::new(Vec::new())),
            next_id: RefCell::new(0),
        }
    }

    /// Registers `listener`. Drop the returned [`Subscription`] to stop listening.
    pub fn subscribe(&self, listener: impl Fn(&T) + 'static) -> Subscription<T> {
        let id = {
            let mut next = self.next_id.borrow_mut();
            *next += 1;
            *next
        };
        self.listeners.borrow_mut().push((id, Rc::new(listener)));
        Subscription {
            id,
            listeners: Rc::downgrade(&self.listeners),
        }
    }

    /// Calls every listener with `value`, in subscription order.
    pub fn emit(&self, value: &T) {
        // Snapshot the handles and release the borrow before calling into user
        // code: a listener is allowed to drop its own subscription mid-emit, which
        // mutates the very Vec we are walking.
        let current: Vec<Listener<T>> = self
            .listeners
            .borrow()
            .iter()
            .map(|(_, listener)| Rc::clone(listener))
            .collect();
        for listener in current {
            listener(value);
        }
    }

    /// How many listeners are subscribed.
    pub fn len(&self) -> usize {
        self.listeners.borrow().len()
    }

    /// Whether nothing is listening.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// Mediator — components talk to a hub instead of to each other.
///
/// Channels are named and typed, so a listener cannot be attached to the wrong
/// event.
#[derive(Default)]
pub struct Mediator {
    subjects: RefCell<HashMap<ChannelKey, Rc<dyn std::any::Any>>>,
}

impl Mediator {
    /// An empty hub.
    pub fn new() -> Self {
        Self::default()
    }

    /// The channel named `name` carrying values of type `T`, created on first use.
    pub fn channel<T: 'static>(&self, name: &'static str) -> Rc<Subject<T>> {
        let key = (name, std::any::TypeId::of::<T>());
        let mut subjects = self.subjects.borrow_mut();
        let entry = subjects
            .entry(key)
            .or_insert_with(|| Rc::new(Subject::<T>::new()) as Rc<dyn std::any::Any>);
        Rc::clone(entry)
            .downcast::<Subject<T>>()
            .expect("channel type is part of its key")
    }
}

/// A channel is identified by its name *and* its payload type, so the same name
/// with a different payload is a different channel.
type ChannelKey = (&'static str, std::any::TypeId);

/// Memento — undo and redo over snapshots of state.
///
/// The [`Clone`] bound is the honest part: no language can snapshot what it cannot
/// copy, and Rust is the one that makes you say so in the signature.
pub struct History<T: Clone> {
    limit: usize,
    past: Vec<T>,
    future: Vec<T>,
    current: T,
}

impl<T: Clone> History<T> {
    /// Starts at `initial`, keeping every past state.
    pub fn new(initial: T) -> Self {
        Self::with_limit(initial, usize::MAX)
    }

    /// Starts at `initial`, keeping at most `limit` past states.
    pub fn with_limit(initial: T, limit: usize) -> Self {
        Self {
            limit,
            past: Vec::new(),
            future: Vec::new(),
            current: initial,
        }
    }

    /// The state now.
    pub fn current(&self) -> &T {
        &self.current
    }

    /// Records the current state and moves to `state`, dropping any redo future.
    pub fn save(&mut self, state: T) {
        self.past.push(self.current.clone());
        if self.past.len() > self.limit {
            self.past.remove(0);
        }
        self.future.clear();
        self.current = state;
    }

    /// Steps back, reporting whether there was anywhere to go.
    pub fn undo(&mut self) -> bool {
        match self.past.pop() {
            Some(previous) => {
                self.future
                    .push(std::mem::replace(&mut self.current, previous));
                true
            }
            None => false,
        }
    }

    /// Steps forward, reporting whether there was anywhere to go.
    pub fn redo(&mut self) -> bool {
        match self.future.pop() {
            Some(next) => {
                self.past.push(std::mem::replace(&mut self.current, next));
                true
            }
            None => false,
        }
    }

    /// Whether [`History::undo`] would move.
    pub fn can_undo(&self) -> bool {
        !self.past.is_empty()
    }

    /// Whether [`History::redo`] would move.
    pub fn can_redo(&self) -> bool {
        !self.future.is_empty()
    }
}

/// Returned by [`StateMachine::send`] for an event the current state disallows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransitionError {
    /// The event, formatted with [`std::fmt::Debug`].
    pub event: String,
    /// The state that refused it.
    pub state: String,
}

impl fmt::Display for TransitionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "gof: {} is not allowed in {}", self.event, self.state)
    }
}

impl std::error::Error for TransitionError {}

/// State — a finite state machine from a transition table.
///
/// ```
/// use gof_patterns::StateMachine;
/// use std::collections::HashMap;
///
/// let mut order = StateMachine::new(
///     "draft",
///     HashMap::from([
///         ("draft", HashMap::from([("pay", "paid")])),
///         ("paid", HashMap::from([("ship", "sent")])),
///         ("sent", HashMap::new()),
///     ]),
/// );
///
/// assert!(order.send("ship").is_err());
/// assert_eq!(order.send("pay").unwrap(), "paid");
/// ```
pub struct StateMachine<S, E>
where
    S: Eq + Hash + Clone + fmt::Debug,
    E: Eq + Hash + Clone + fmt::Debug,
{
    state: S,
    transitions: HashMap<S, HashMap<E, S>>,
    changes: Vec<(S, S, E)>,
}

impl<S, E> StateMachine<S, E>
where
    S: Eq + Hash + Clone + fmt::Debug,
    E: Eq + Hash + Clone + fmt::Debug,
{
    /// A machine in the initial state.
    pub fn new(initial: S, transitions: HashMap<S, HashMap<E, S>>) -> Self {
        Self {
            state: initial,
            transitions,
            changes: Vec::new(),
        }
    }

    /// The current state.
    pub fn state(&self) -> &S {
        &self.state
    }

    /// Whether `event` is allowed in the current state.
    pub fn can(&self, event: &E) -> bool {
        self.transitions
            .get(&self.state)
            .is_some_and(|allowed| allowed.contains_key(event))
    }

    /// Applies `event`, returning the new state, or a [`TransitionError`].
    pub fn send(&mut self, event: E) -> Result<S, TransitionError> {
        let target = self
            .transitions
            .get(&self.state)
            .and_then(|allowed| allowed.get(&event))
            .cloned()
            .ok_or_else(|| TransitionError {
                event: format!("{event:?}"),
                state: format!("{:?}", self.state),
            })?;
        let from = std::mem::replace(&mut self.state, target.clone());
        self.changes.push((from, target.clone(), event));
        Ok(target)
    }

    /// Every transition so far: the state before, the state after, and the event.
    /// An audit trail without touching the call sites.
    pub fn changes(&self) -> &[(S, S, E)] {
        &self.changes
    }
}

/// Returned by a [`visitor`] with no arm for the tag and no fallback.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VisitorError {
    /// The tag, formatted with [`std::fmt::Debug`].
    pub tag: String,
}

impl fmt::Display for VisitorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "gof: no visitor for {}", self.tag)
    }
}

impl std::error::Error for VisitorError {}

/// Visitor — dispatch on a tag you extract from the node.
///
/// When your nodes are an `enum`, `match` is the better answer and the compiler
/// checks that you handled every variant — use that. This is for a tag field,
/// which is what a decoded payload or a database row gives you.
pub fn visitor<Node, Tag, Result_>(
    tag: impl Fn(&Node) -> Tag,
    visitors: HashMap<Tag, Answer<Node, Result_>>,
    fallback: Option<Answer<Node, Result_>>,
) -> impl Fn(&Node) -> Result<Result_, VisitorError>
where
    Tag: Eq + Hash + fmt::Debug,
{
    move |node| {
        let key = tag(node);
        if let Some(visit) = visitors.get(&key) {
            return Ok(visit(node));
        }
        match &fallback {
            Some(last) => Ok(last(node)),
            None => Err(VisitorError {
                tag: format!("{key:?}"),
            }),
        }
    }
}
