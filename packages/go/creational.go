// Package gof implements the 22 Gang of Four design patterns as small, typed
// helpers: you supply the domain logic, the helper owns the bookkeeping.
//
// Go has no inheritance, so several patterns are a func or a channel rather than a
// class hierarchy — where the language already does the job, the doc comment says
// so and you should use the language. See the README for the full table.
//
// Nothing here imports anything outside the standard library.
package gof

import (
	"encoding/json"
	"fmt"
	"sync"
)

// Singleton holds one lazily built value, shared.
//
// [sync.OnceValue] is the idiomatic way to do this and you should prefer it. This
// exists for [Singleton.Reset], which a test needs and OnceValue does not offer.
type Singleton[T any] struct {
	factory func() T
	mu      sync.Mutex
	value   T
	built   bool
}

// NewSingleton returns a Singleton that calls factory at most once.
func NewSingleton[T any](factory func() T) *Singleton[T] {
	return &Singleton[T]{factory: factory}
}

// Value builds the value on first call and returns the same one after that. It is
// safe to call from several goroutines.
func (s *Singleton[T]) Value() T {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.built {
		s.value = s.factory()
		s.built = true
	}
	return s.value
}

// Reset drops the value, so the next Value call builds a new one.
func (s *Singleton[T]) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	var zero T
	s.value = zero
	s.built = false
}

// Registry holds factories keyed by name: Factory Method, Abstract Factory and
// Strategy are the same code, differing only in what you register.
//
// F is the func type you choose, so the call stays typed:
//
//	rails := gof.NewRegistry[string, func(int) string]()
//	rails.Register("stripe", func(cents int) string { return fmt.Sprint("stripe:", cents) })
//	send, _ := rails.Get("stripe")
//	send(500)
type Registry[K comparable, F any] struct {
	mu        sync.RWMutex
	factories map[K]F
}

// NewRegistry returns an empty Registry.
func NewRegistry[K comparable, F any]() *Registry[K, F] {
	return &Registry[K, F]{factories: make(map[K]F)}
}

// Register stores factory under key and returns it, so a registration can be kept
// in a variable.
func (r *Registry[K, F]) Register(key K, factory F) F {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.factories[key] = factory
	return factory
}

// Get returns the factory for key, or an error naming the key.
func (r *Registry[K, F]) Get(key K) (F, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	factory, ok := r.factories[key]
	if !ok {
		var zero F
		return zero, fmt.Errorf("gof: nothing registered for %v", key)
	}
	return factory, nil
}

// MustGet is Get for the case where a missing key is a programming error.
func (r *Registry[K, F]) MustGet(key K) F {
	factory, err := r.Get(key)
	if err != nil {
		panic(err)
	}
	return factory
}

// Has reports whether key is registered.
func (r *Registry[K, F]) Has(key K) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.factories[key]
	return ok
}

// Keys returns the registered keys, in no particular order.
func (r *Registry[K, F]) Keys() []K {
	r.mu.RLock()
	defer r.mu.RUnlock()
	keys := make([]K, 0, len(r.factories))
	for key := range r.factories {
		keys = append(keys, key)
	}
	return keys
}

// Clone is Prototype: a deep copy, so a new value starts from an existing one.
//
// Go has no generic deep copy, so this round-trips through JSON. That means the
// type has to be JSON-serialisable, and anything JSON cannot carry is dropped:
// funcs, channels, unexported fields, cycles. For a type you own, a Clone method
// is faster and exact — write that.
func Clone[T any](value T) (T, error) {
	var copied T
	encoded, err := json.Marshal(value)
	if err != nil {
		return copied, fmt.Errorf("gof: Clone could not encode: %w", err)
	}
	if err := json.Unmarshal(encoded, &copied); err != nil {
		return copied, fmt.Errorf("gof: Clone could not decode: %w", err)
	}
	return copied, nil
}

// Builder builds a value step by step.
//
// Functional options — New(opts ...Option) — are the idiomatic Go builder and you
// should reach for those first. [Builder.WithIf] is what this adds: construction
// spread across branches, such as a query assembled from optional filters.
type Builder[T any] struct {
	draft T
}

// NewBuilder returns a Builder starting from draft.
func NewBuilder[T any](draft T) *Builder[T] {
	return &Builder[T]{draft: draft}
}

// With applies change to the draft.
func (b *Builder[T]) With(change func(T) T) *Builder[T] {
	b.draft = change(b.draft)
	return b
}

// WithIf applies change only when condition holds.
func (b *Builder[T]) WithIf(condition bool, change func(T) T) *Builder[T] {
	if condition {
		return b.With(change)
	}
	return b
}

// Build returns the value.
func (b *Builder[T]) Build() T { return b.draft }
