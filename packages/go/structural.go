package gof

import (
	"iter"
	"sync"
)

// Adapt is Adapter: expose an incompatible value through the interface you want.
//
// Thin on purpose. In Go the idiomatic adapter is a small struct that implements
// your interface, or interface embedding, and you should usually write that. This
// names the intent where a func literal is enough.
func Adapt[Source, API any](source Source, build func(Source) API) API {
	return build(source)
}

// Decorate is Decorator: wrap a func in layers — retry, cache, log — without
// touching it. The first wrapper is the outermost, so the arguments read in the
// order they run.
//
//	charge := gof.Decorate(rawCharge, withLog, withRetry(3))
func Decorate[In, Out any](
	fn func(In) Out,
	wrappers ...func(func(In) Out) func(In) Out,
) func(In) Out {
	wrapped := fn
	for i := len(wrappers) - 1; i >= 0; i-- {
		wrapped = wrappers[i](wrapped)
	}
	return wrapped
}

// Composite lets a tree of nodes be treated like a single node.
type Composite[T any] struct {
	Value    T
	children []*Composite[T]
}

// NewComposite returns a node holding value, with optional children.
func NewComposite[T any](value T, children ...*Composite[T]) *Composite[T] {
	return &Composite[T]{Value: value, children: children}
}

// Add appends children and returns the node, so calls chain.
func (c *Composite[T]) Add(nodes ...*Composite[T]) *Composite[T] {
	c.children = append(c.children, nodes...)
	return c
}

// Remove drops one child, reporting whether it was there.
func (c *Composite[T]) Remove(child *Composite[T]) bool {
	for i, existing := range c.children {
		if existing == child {
			c.children = append(c.children[:i], c.children[i+1:]...)
			return true
		}
	}
	return false
}

// Children returns the direct children.
func (c *Composite[T]) Children() []*Composite[T] { return c.children }

// Walk yields the subtree depth-first, self first. It is an [iter.Seq], so a
// `break` in the range loop stops the traversal instead of walking the rest.
func (c *Composite[T]) Walk() iter.Seq[*Composite[T]] {
	return func(yield func(*Composite[T]) bool) {
		c.walk(yield)
	}
}

func (c *Composite[T]) walk(yield func(*Composite[T]) bool) bool {
	if !yield(c) {
		return false
	}
	for _, child := range c.children {
		if !child.walk(yield) {
			return false
		}
	}
	return true
}

// Sum adds of(node.Value) over the whole subtree.
func (c *Composite[T]) Sum(of func(T) float64) float64 {
	total := 0.0
	for node := range c.Walk() {
		total += of(node.Value)
	}
	return total
}

// Size counts the nodes in the subtree, including this one.
func (c *Composite[T]) Size() int {
	count := 0
	for range c.Walk() {
		count++
	}
	return count
}

// Flyweight shares one value per key instead of re-creating equal values.
//
//	types := gof.NewFlyweight(func(name string) *TreeType { return &TreeType{Name: name} })
//	types.Get("oak") == types.Get("oak")   // same pointer
type Flyweight[K comparable, V any] struct {
	factory func(K) V
	mu      sync.Mutex
	cache   map[K]V
}

// NewFlyweight returns a Flyweight that builds values with factory.
func NewFlyweight[K comparable, V any](factory func(K) V) *Flyweight[K, V] {
	return &Flyweight[K, V]{factory: factory, cache: make(map[K]V)}
}

// Get returns the shared value for key, building it on first use. It is safe to
// call from several goroutines, and factory runs once per key.
func (f *Flyweight[K, V]) Get(key K) V {
	f.mu.Lock()
	defer f.mu.Unlock()
	value, ok := f.cache[key]
	if !ok {
		value = f.factory(key)
		f.cache[key] = value
	}
	return value
}

// Len reports how many distinct keys are held.
func (f *Flyweight[K, V]) Len() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.cache)
}

// Clear drops every cached value.
func (f *Flyweight[K, V]) Clear() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.cache = make(map[K]V)
}

// Bridge is a stable abstraction whose implementation can be swapped underneath.
//
// Callers hold the Bridge and read [Bridge.API] per call, so a [Bridge.Swap]
// reaches everyone who already has it. Passing the implementation into a
// constructor — the textbook version — makes every holder re-wire instead.
type Bridge[Impl, API any] struct {
	build func(Impl) API
	mu    sync.RWMutex
	api   API
}

// NewBridge returns a Bridge over the given implementation.
func NewBridge[Impl, API any](build func(Impl) API, implementation Impl) *Bridge[Impl, API] {
	return &Bridge[Impl, API]{build: build, api: build(implementation)}
}

// API returns the current abstraction. Read it per call, not once into a variable,
// or a later Swap will not reach you.
func (b *Bridge[Impl, API]) API() API {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.api
}

// Swap replaces the implementation behind the abstraction.
func (b *Bridge[Impl, API]) Swap(implementation Impl) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.api = b.build(implementation)
}

// Facade and Proxy have no helper in Go, because the standard library already does
// both properly with sync.OnceValue — a struct whose subsystems are built on first
// use:
//
//	type Checkout struct {
//		payments func() *PaymentClient // sync.OnceValue(func() *PaymentClient { ... })
//		mail     func() *Mailer
//	}
//
//	func (c *Checkout) Pay(cents int) string { return c.payments().Charge(cents) }
//
// OnceValue is lazy, runs the factory once and is goroutine-safe. Nothing a helper
// could add. See the README table.
