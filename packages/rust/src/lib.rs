//! The 22 Gang of Four design patterns as small, typed helpers: you supply the
//! domain logic, the helper owns the bookkeeping.
//!
//! Rust is the package where the patterns changed shape rather than being ported.
//! Ownership decides the API:
//!
//! - **Sharing is [`Arc`](std::sync::Arc), not a reference.** [`Singleton`] and
//!   [`Flyweight`] hand out `Arc<T>` because a value living in a lock cannot be
//!   handed out as `&T`.
//! - **Chain of Responsibility has no `next` callback.** A handler returns
//!   [`Option`]: `Some` answers, `None` passes the turn. The borrow checker would
//!   fight a recursive `next` closure, and this reads better anyway.
//! - **Unsubscribing is a guard, not a call.** [`Subject::subscribe`] returns a
//!   [`Subscription`] that removes the listener when it drops, which is the Rust
//!   way to say "this lasts as long as you hold it".
//! - **Memento needs [`Clone`], and says so in the bound.** No language can snapshot
//!   what it cannot copy; Rust is the one that makes you admit it up front.
//!
//! Eight of the 22 ship no code, because the language or the standard library
//! already does the job — `Clone` is Prototype, `LazyLock` is Proxy, `match` on an
//! enum is Visitor with exhaustiveness checked. The README table says which, and
//! what to write instead.
//!
//! Nothing here depends on anything outside `std`.

mod behavioral;
mod creational;
mod structural;

pub use behavioral::{
    chain, visitor, Answer, ChainError, Command, CommandBus, Handler, History, Mediator,
    StateMachine, Subject, Subscription, TransitionError, VisitorError,
};
pub use creational::{Builder, Registry, RegistryError, Singleton};
pub use structural::{decorate, Bridge, Composite, Flyweight, Layer, Wrapper};
