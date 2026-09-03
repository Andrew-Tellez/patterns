//! Structural patterns.
//!
//! Three ship no helper, because the language already does them:
//!
//! - **Adapter** — a newtype implementing your trait, or trait delegation. Four
//!   lines, checked by the compiler.
//! - **Facade** — a struct whose subsystems are [`std::sync::OnceLock`] fields,
//!   each built on first use.
//! - **Proxy** — [`std::sync::LazyLock`], which is lazy, runs once and is `Sync`.

use std::collections::HashMap;
use std::hash::Hash;
use std::sync::{Arc, Mutex, RwLock};

/// A boxed function of one argument: the unit [`decorate`] composes.
pub type Layer<In, Out> = Box<dyn Fn(In) -> Out>;

/// One layer of a [`decorate`] stack: it receives the function underneath it and
/// returns the function that replaces it.
pub type Wrapper<In, Out> = Box<dyn Fn(Layer<In, Out>) -> Layer<In, Out>>;

/// Decorator — wrap a function in layers (retry, cache, log) without touching it.
/// The first wrapper is the outermost, so the list reads in the order it runs.
///
/// ```
/// use gof_patterns::{decorate, Layer};
///
/// use gof_patterns::Wrapper;
///
/// let log: Wrapper<u32, String> =
///     Box::new(|next| Box::new(move |n| format!("log({})", next(n))));
/// let twice: Wrapper<u32, String> = Box::new(|next| Box::new(move |n| next(n * 2)));
///
/// let call = decorate(Box::new(|n: u32| n.to_string()), vec![log, twice]);
/// assert_eq!(call(3), "log(6)");
/// ```
pub fn decorate<In, Out>(
    function: Layer<In, Out>,
    wrappers: Vec<Wrapper<In, Out>>,
) -> Layer<In, Out> {
    wrappers
        .into_iter()
        .rev()
        .fold(function, |next, wrap| wrap(next))
}

/// Composite — treat a tree of nodes like a single node.
///
/// [`Composite::walk`] is a lazy iterator over an explicit stack, so `find` and
/// `take` stop the traversal instead of visiting the whole tree.
///
/// ```
/// use gof_patterns::Composite;
///
/// let mut root = Composite::new(10.0);
/// root.add(Composite::new(5.0));
/// assert_eq!(root.sum(|price| *price), 15.0);
/// assert_eq!(root.len(), 2);
/// ```
pub struct Composite<T> {
    /// The value this node holds.
    pub value: T,
    children: Vec<Composite<T>>,
}

impl<T> Composite<T> {
    /// A leaf holding `value`.
    pub fn new(value: T) -> Self {
        Self {
            value,
            children: Vec::new(),
        }
    }

    /// A node holding `value` with the given children.
    pub fn with_children(value: T, children: Vec<Composite<T>>) -> Self {
        Self { value, children }
    }

    /// Appends a child.
    pub fn add(&mut self, child: Composite<T>) -> &mut Self {
        self.children.push(child);
        self
    }

    /// Removes the child at `index`, returning it, or `None` if out of range.
    pub fn remove(&mut self, index: usize) -> Option<Composite<T>> {
        if index < self.children.len() {
            Some(self.children.remove(index))
        } else {
            None
        }
    }

    /// The direct children.
    pub fn children(&self) -> &[Composite<T>] {
        &self.children
    }

    /// Depth-first, self first, and lazy.
    pub fn walk(&self) -> impl Iterator<Item = &Composite<T>> {
        let mut stack = vec![self];
        std::iter::from_fn(move || {
            let node = stack.pop()?;
            // Push in reverse so the leftmost child comes out first.
            stack.extend(node.children.iter().rev());
            Some(node)
        })
    }

    /// Adds `of(value)` over the whole subtree.
    pub fn sum(&self, of: impl Fn(&T) -> f64) -> f64 {
        self.walk().map(|node| of(&node.value)).sum()
    }

    /// How many nodes are in the subtree, including this one.
    pub fn len(&self) -> usize {
        self.walk().count()
    }

    /// Whether this node has no children.
    pub fn is_empty(&self) -> bool {
        self.children.is_empty()
    }
}

/// Flyweight — share one value per key instead of re-creating equal values.
///
/// Values come back as `Arc<V>`: they live in a map behind a lock, so they cannot
/// be lent out as `&V`. Sharing *is* the `Arc`.
///
/// ```
/// use gof_patterns::Flyweight;
/// use std::sync::Arc;
///
/// // K is annotated because a bare `&str` closure argument would infer `K = str`,
/// // which is unsized and cannot be a key.
/// let types = Flyweight::new(|name: &&str| name.to_uppercase());
/// assert!(Arc::ptr_eq(&types.get("oak"), &types.get("oak")));
/// assert_eq!(types.len(), 1);
/// ```
pub struct Flyweight<K: Eq + Hash + Clone, V, F: Fn(&K) -> V> {
    factory: F,
    cache: Mutex<HashMap<K, Arc<V>>>,
}

impl<K: Eq + Hash + Clone, V, F: Fn(&K) -> V> Flyweight<K, V, F> {
    /// A flyweight that builds values with `factory`.
    pub fn new(factory: F) -> Self {
        Self {
            factory,
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// The shared value for `key`, built on first use.
    pub fn get(&self, key: K) -> Arc<V> {
        let mut cache = self.cache.lock().expect("Flyweight lock poisoned");
        Arc::clone(
            cache
                .entry(key.clone())
                .or_insert_with(|| Arc::new((self.factory)(&key))),
        )
    }

    /// How many distinct keys are held.
    pub fn len(&self) -> usize {
        self.cache.lock().expect("Flyweight lock poisoned").len()
    }

    /// Whether nothing is cached.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Drops every cached value.
    pub fn clear(&self) {
        self.cache.lock().expect("Flyweight lock poisoned").clear();
    }
}

/// Bridge — a stable abstraction whose implementation can be swapped underneath.
///
/// Callers hold the `Bridge` and call [`Bridge::api`] per use, so a
/// [`Bridge::swap`] reaches everyone who already has it. Passing the
/// implementation into a constructor makes every holder re-wire instead.
///
/// The abstraction comes back as an `Arc`, for the same reason as everywhere else
/// here: it lives behind a lock so it can be replaced.
///
/// ```
/// use gof_patterns::Bridge;
///
/// let storage = Bridge::new(
///     |prefix: &'static str| {
///         Box::new(move |key: &str| format!("{prefix}:{key}")) as Box<dyn Fn(&str) -> String>
///     },
///     "s3",
/// );
/// assert_eq!((storage.api())("a"), "s3:a");
///
/// storage.swap("disk");
/// assert_eq!((storage.api())("a"), "disk:a");
/// ```
pub struct Bridge<Impl, Api> {
    build: Box<dyn Fn(Impl) -> Api>,
    api: RwLock<Arc<Api>>,
}

impl<Impl, Api> Bridge<Impl, Api> {
    /// Builds the abstraction over `implementation`.
    pub fn new(build: impl Fn(Impl) -> Api + 'static, implementation: Impl) -> Self {
        let build = Box::new(build);
        let api = Arc::new(build(implementation));
        Self {
            build,
            api: RwLock::new(api),
        }
    }

    /// The current abstraction. Call this per use, not once into a variable, or a
    /// later [`Bridge::swap`] will not reach you.
    pub fn api(&self) -> Arc<Api> {
        Arc::clone(&self.api.read().expect("Bridge lock poisoned"))
    }

    /// Replaces the implementation behind the abstraction.
    pub fn swap(&self, implementation: Impl) {
        *self.api.write().expect("Bridge lock poisoned") = Arc::new((self.build)(implementation));
    }
}
