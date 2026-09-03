//! Creational patterns.
//!
//! Prototype ships no helper: [`Clone`] *is* the pattern, and `#[derive(Clone)]`
//! is shorter than anything wrapping it could be.

use std::collections::HashMap;
use std::fmt;
use std::hash::Hash;
use std::sync::{Arc, RwLock};

/// Singleton — one lazily built value, shared.
///
/// [`std::sync::LazyLock`] is the idiomatic way to do this and you should prefer
/// it. This exists for [`Singleton::reset`], which a test needs and `LazyLock`
/// does not offer.
///
/// Access is by `Arc<T>` rather than `&T`: the value lives behind a lock, so it
/// cannot be lent out as a plain reference.
///
/// ```
/// use gof_patterns::Singleton;
///
/// let calls = std::sync::atomic::AtomicUsize::new(0);
/// let config = Singleton::new(|| {
///     calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
///     "MXN".to_string()
/// });
///
/// assert!(Arc::ptr_eq(&config.get(), &config.get()));
/// assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
/// # use std::sync::Arc;
/// ```
pub struct Singleton<T, F = fn() -> T>
where
    F: Fn() -> T,
{
    factory: F,
    value: RwLock<Option<Arc<T>>>,
}

impl<T, F: Fn() -> T> Singleton<T, F> {
    /// Wraps a factory that will be called at most once per build.
    pub fn new(factory: F) -> Self {
        Self {
            factory,
            value: RwLock::new(None),
        }
    }

    /// Builds the value on first call and returns the same `Arc` afterwards. Safe
    /// to call from several threads; the factory runs once even under contention.
    pub fn get(&self) -> Arc<T> {
        if let Some(existing) = self.value.read().expect("Singleton lock poisoned").as_ref() {
            return Arc::clone(existing);
        }
        let mut slot = self.value.write().expect("Singleton lock poisoned");
        // Another thread may have built it between the read and the write.
        if let Some(existing) = slot.as_ref() {
            return Arc::clone(existing);
        }
        let created = Arc::new((self.factory)());
        *slot = Some(Arc::clone(&created));
        created
    }

    /// Drops the value, so the next [`Singleton::get`] builds a new one.
    pub fn reset(&self) {
        *self.value.write().expect("Singleton lock poisoned") = None;
    }
}

/// The error [`Registry::get`] returns, naming the key it did not know.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistryError {
    /// The key, formatted with [`std::fmt::Debug`], because `K` need not be `Display`.
    pub key: String,
}

impl fmt::Display for RegistryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "gof: nothing registered for {}", self.key)
    }
}

impl std::error::Error for RegistryError {}

/// Factory Method, Abstract Factory and Strategy — factories keyed by name. The
/// same code; only what you register differs.
///
/// `F` is the type you choose, usually a boxed closure, so the call stays typed:
///
/// ```
/// use gof_patterns::Registry;
///
/// let mut rails: Registry<&str, Box<dyn Fn(u32) -> String>> = Registry::new();
/// rails.register("stripe", Box::new(|cents| format!("stripe:{cents}")));
///
/// assert_eq!(rails.get("stripe").unwrap()(500), "stripe:500");
/// assert!(rails.get("paypal").is_err());
/// ```
pub struct Registry<K: Eq + Hash + fmt::Debug, F> {
    factories: HashMap<K, F>,
}

impl<K: Eq + Hash + fmt::Debug, F> Registry<K, F> {
    /// An empty registry.
    pub fn new() -> Self {
        Self {
            factories: HashMap::new(),
        }
    }

    /// Stores `factory` under `key`, replacing anything already there.
    pub fn register(&mut self, key: K, factory: F) {
        self.factories.insert(key, factory);
    }

    /// The factory for `key`, or a [`RegistryError`] naming it.
    pub fn get(&self, key: K) -> Result<&F, RegistryError> {
        self.factories.get(&key).ok_or_else(|| RegistryError {
            key: format!("{key:?}"),
        })
    }

    /// Whether `key` is registered.
    pub fn has(&self, key: &K) -> bool {
        self.factories.contains_key(key)
    }

    /// The registered keys, in no particular order.
    pub fn keys(&self) -> impl Iterator<Item = &K> {
        self.factories.keys()
    }

    /// How many factories are registered.
    pub fn len(&self) -> usize {
        self.factories.len()
    }

    /// Whether nothing is registered.
    pub fn is_empty(&self) -> bool {
        self.factories.is_empty()
    }
}

impl<K: Eq + Hash + fmt::Debug, F> Default for Registry<K, F> {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder — construction spread across branches.
///
/// A hand-written builder with typed setters is more idiomatic when the fields are
/// known; [`Builder::with_if`] is what this adds, for a query or a request
/// assembled from optional parts. It takes `self` by value, so the chain moves
/// rather than borrowing.
///
/// ```
/// use gof_patterns::Builder;
///
/// #[derive(Debug, PartialEq, Default, Clone)]
/// struct Query { table: String, user: Option<String> }
///
/// let user = Some("u1".to_string());
/// let query = Builder::new(Query::default())
///     .with(|mut q| { q.table = "orders".into(); q })
///     .with_if(user.is_some(), |mut q| { q.user = user.clone(); q })
///     .build();
///
/// assert_eq!(query.table, "orders");
/// assert_eq!(query.user.as_deref(), Some("u1"));
/// ```
pub struct Builder<T> {
    draft: T,
}

impl<T> Builder<T> {
    /// Starts from `draft`.
    pub fn new(draft: T) -> Self {
        Self { draft }
    }

    /// Applies `change`.
    #[must_use]
    pub fn with(mut self, change: impl FnOnce(T) -> T) -> Self {
        self.draft = change(self.draft);
        self
    }

    /// Applies `change` only when `condition` holds.
    #[must_use]
    pub fn with_if(self, condition: bool, change: impl FnOnce(T) -> T) -> Self {
        if condition {
            self.with(change)
        } else {
            self
        }
    }

    /// Hands back the value.
    pub fn build(self) -> T {
        self.draft
    }
}
