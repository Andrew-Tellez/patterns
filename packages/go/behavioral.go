package gof

import (
	"errors"
	"fmt"
	"iter"
	"math"
	"sync"
)

// ErrNoHandler is returned by a [Chain] whose handlers all declined and that was
// given no fallback.
var ErrNoHandler = errors.New("gof: no handler answered and no fallback was given")

// Chain is Chain of Responsibility: each handler either answers or calls next.
//
// Pass nil for fallback to get [ErrNoHandler] when nothing answers; the returned
// func reports it through the error result.
//
//	route := gof.Chain([]func(int, func() string) string{
//		func(level int, next func() string) string { if level == 1 { return "bot" }; return next() },
//	}, func(int) string { return "queue" })
func Chain[Req, Res any](
	handlers []func(Req, func() Res) Res,
	fallback func(Req) Res,
) func(Req) (Res, error) {
	return func(request Req) (result Res, err error) {
		var step func(int) Res
		step = func(i int) Res {
			if i >= len(handlers) {
				if fallback == nil {
					err = ErrNoHandler
					var zero Res
					return zero
				}
				return fallback(request)
			}
			return handlers[i](request, func() Res { return step(i + 1) })
		}
		return step(0), err
	}
}

// Command is one undoable operation, built from two funcs so the simple case needs
// no type of its own. A Command with a nil Undo still runs, but is not tracked.
type Command[T any] struct {
	Execute func() T
	Undo    func()
}

// CommandBus runs commands and keeps the undo and redo history.
//
// Use the package-level [Run] rather than a method: a Go method cannot introduce a
// type parameter, so the command's result type has to come from a function.
type CommandBus struct {
	done   []Command[any]
	undone []Command[any]
}

// NewCommandBus returns an empty bus.
func NewCommandBus() *CommandBus { return &CommandBus{} }

// Run executes cmd, records it if it can be undone, and returns its result.
func Run[T any](bus *CommandBus, cmd Command[T]) T {
	result := cmd.Execute()
	bus.undone = bus.undone[:0]
	if cmd.Undo != nil {
		bus.done = append(bus.done, Command[any]{
			Execute: func() any { return cmd.Execute() },
			Undo:    cmd.Undo,
		})
	}
	return result
}

// Undo reverses the last undoable command, reporting whether there was one.
func (b *CommandBus) Undo() bool {
	if len(b.done) == 0 {
		return false
	}
	cmd := b.done[len(b.done)-1]
	b.done = b.done[:len(b.done)-1]
	cmd.Undo()
	b.undone = append(b.undone, cmd)
	return true
}

// Redo re-runs the last undone command, reporting whether there was one.
func (b *CommandBus) Redo() bool {
	if len(b.undone) == 0 {
		return false
	}
	cmd := b.undone[len(b.undone)-1]
	b.undone = b.undone[:len(b.undone)-1]
	cmd.Execute()
	b.done = append(b.done, cmd)
	return true
}

// CanUndo reports whether there is anything to undo.
func (b *CommandBus) CanUndo() bool { return len(b.done) > 0 }

// CanRedo reports whether there is anything to redo.
func (b *CommandBus) CanRedo() bool { return len(b.undone) > 0 }

// Subject is Observer: one typed channel of values. Subscribe returns the
// unsubscribe func.
//
// A Go channel plus a goroutine is the idiomatic fan-out and is better when the
// consumers are concurrent. This is for synchronous callbacks, where a channel
// would mean a goroutine per listener and no ordering guarantee.
type Subject[T any] struct {
	mu        sync.Mutex
	listeners []*func(T)
}

// Subscribe registers listener and returns a func that removes it. Calling that
// func twice is harmless.
func (s *Subject[T]) Subscribe(listener func(T)) func() {
	s.mu.Lock()
	defer s.mu.Unlock()
	handle := &listener
	s.listeners = append(s.listeners, handle)
	return func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		for i, existing := range s.listeners {
			if existing == handle {
				s.listeners = append(s.listeners[:i], s.listeners[i+1:]...)
				return
			}
		}
	}
}

// Emit calls every listener with value, in subscription order.
func (s *Subject[T]) Emit(value T) {
	s.mu.Lock()
	// Copy first: a listener may unsubscribe while being called.
	current := make([]*func(T), len(s.listeners))
	copy(current, s.listeners)
	s.mu.Unlock()
	for _, listener := range current {
		(*listener)(value)
	}
}

// Len reports how many listeners are subscribed.
func (s *Subject[T]) Len() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.listeners)
}

// Channel is a named, typed event for a [Mediator]. Declare it once and share it;
// the name is only for debugging.
type Channel[T any] struct{ Name string }

// NewChannel returns a Channel carrying values of type T.
func NewChannel[T any](name string) *Channel[T] { return &Channel[T]{Name: name} }

// Mediator is a hub components talk to instead of to each other. Channels carry
// their payload type, so a listener cannot be attached to the wrong event.
//
// [On] and [Emit] are package-level funcs, not methods, because a Go method cannot
// introduce a type parameter.
type Mediator struct {
	mu       sync.Mutex
	subjects map[any]any
}

// NewMediator returns an empty hub.
func NewMediator() *Mediator { return &Mediator{subjects: make(map[any]any)} }

func subjectFor[T any](m *Mediator, ch *Channel[T]) *Subject[T] {
	m.mu.Lock()
	defer m.mu.Unlock()
	if existing, ok := m.subjects[ch]; ok {
		return existing.(*Subject[T])
	}
	created := &Subject[T]{}
	m.subjects[ch] = created
	return created
}

// On subscribes listener to ch and returns the unsubscribe func.
func On[T any](m *Mediator, ch *Channel[T], listener func(T)) func() {
	return subjectFor(m, ch).Subscribe(listener)
}

// Emit sends payload to every listener on ch.
func Emit[T any](m *Mediator, ch *Channel[T], payload T) {
	subjectFor(m, ch).Emit(payload)
}

// History is Memento: undo and redo over snapshots of state.
//
// Snapshots are stored as given. Pass [WithSnapshot] when the state is mutated in
// place, or the history will fill with the same mutated value.
type History[T any] struct {
	limit    int
	snapshot func(T) T
	past     []T
	future   []T
	current  T
}

// HistoryOption configures a [History].
type HistoryOption[T any] func(*History[T])

// WithLimit caps how many past states are kept; older ones are dropped.
func WithLimit[T any](limit int) HistoryOption[T] {
	return func(h *History[T]) { h.limit = limit }
}

// WithSnapshot sets the copy func applied to every saved state.
func WithSnapshot[T any](snapshot func(T) T) HistoryOption[T] {
	return func(h *History[T]) { h.snapshot = snapshot }
}

// NewHistory returns a History starting at initial.
func NewHistory[T any](initial T, options ...HistoryOption[T]) *History[T] {
	h := &History[T]{limit: math.MaxInt, snapshot: func(value T) T { return value }}
	for _, option := range options {
		option(h)
	}
	h.current = h.snapshot(initial)
	return h
}

// Current returns the state now.
func (h *History[T]) Current() T { return h.current }

// Save records the current state and moves to the new one, dropping any redo future.
func (h *History[T]) Save(state T) {
	h.past = append(h.past, h.current)
	if len(h.past) > h.limit {
		h.past = h.past[1:]
	}
	h.future = h.future[:0]
	h.current = h.snapshot(state)
}

// Undo steps back, reporting whether there was anywhere to go.
func (h *History[T]) Undo() bool {
	if len(h.past) == 0 {
		return false
	}
	h.future = append(h.future, h.current)
	h.current = h.past[len(h.past)-1]
	h.past = h.past[:len(h.past)-1]
	return true
}

// Redo steps forward, reporting whether there was anywhere to go.
func (h *History[T]) Redo() bool {
	if len(h.future) == 0 {
		return false
	}
	h.past = append(h.past, h.current)
	h.current = h.future[len(h.future)-1]
	h.future = h.future[:len(h.future)-1]
	return true
}

// CanUndo reports whether Undo would move.
func (h *History[T]) CanUndo() bool { return len(h.past) > 0 }

// CanRedo reports whether Redo would move.
func (h *History[T]) CanRedo() bool { return len(h.future) > 0 }

// Change is one transition of a [StateMachine].
type Change[S, E any] struct {
	From, To S
	Event    E
}

// StateMachine is State: a finite state machine from a transition table.
//
//	order := gof.NewStateMachine("draft", map[string]map[string]string{
//		"draft": {"pay": "paid"},
//		"paid":  {"ship": "sent"},
//		"sent":  {},
//	})
//	order.Send("pay")   // "paid", nil
//	order.Send("pay")   // error: "pay" is not allowed in "sent"
//
// States and events are comparable type parameters, so a named string type or an
// int enum works and reads better than bare strings.
type StateMachine[S, E comparable] struct {
	state       S
	transitions map[S]map[E]S

	// Changes emits every transition, which is an audit trail without touching
	// the call sites.
	Changes Subject[Change[S, E]]
}

// NewStateMachine returns a machine in the initial state.
func NewStateMachine[S, E comparable](initial S, transitions map[S]map[E]S) *StateMachine[S, E] {
	return &StateMachine[S, E]{state: initial, transitions: transitions}
}

// State returns the current state.
func (m *StateMachine[S, E]) State() S { return m.state }

// Can reports whether event is allowed in the current state.
func (m *StateMachine[S, E]) Can(event E) bool {
	_, ok := m.transitions[m.state][event]
	return ok
}

// Send applies event, returning the new state, or an error naming the event and
// the state that refused it.
func (m *StateMachine[S, E]) Send(event E) (S, error) {
	target, ok := m.transitions[m.state][event]
	if !ok {
		return m.state, fmt.Errorf("gof: %v is not allowed in %v", event, m.state)
	}
	from := m.state
	m.state = target
	m.Changes.Emit(Change[S, E]{From: from, To: target, Event: event})
	return target, nil
}

// MustSend is Send for the case where an illegal transition is a programming error.
func (m *StateMachine[S, E]) MustSend(event E) S {
	state, err := m.Send(event)
	if err != nil {
		panic(err)
	}
	return state
}

// Visitor dispatches on a tag you extract from the node, rather than a switch
// repeated in every function that walks the tree.
//
// When your nodes are distinct Go types, a type switch is clearer and the compiler
// helps — use that. This is for a tag field, which is what a decoded JSON payload
// or a database row gives you.
func Visitor[Node any, Tag comparable, Result any](
	tag func(Node) Tag,
	visitors map[Tag]func(Node) Result,
	fallback func(Node) Result,
) func(Node) (Result, error) {
	return func(node Node) (Result, error) {
		key := tag(node)
		if visit, ok := visitors[key]; ok {
			return visit(node), nil
		}
		if fallback != nil {
			return fallback(node), nil
		}
		var zero Result
		return zero, fmt.Errorf("gof: no visitor for %v", key)
	}
}

// Iterate turns an external cursor into an [iter.Seq], so `for range` walks it.
//
// Drivers and SDKs hand you a HasNext/Next pair. This stays lazy: next runs only
// when the loop asks, so a `break` stops pulling. Writing the source yourself? A
// plain iter.Seq or a channel is simpler — this is for sources you did not write.
func Iterate[T any](hasNext func() bool, next func() T) iter.Seq[T] {
	return func(yield func(T) bool) {
		for hasNext() {
			if !yield(next()) {
				return
			}
		}
	}
}

// Template Method has no helper in Go. A struct of func fields with a constructor
// that fills the defaults is the whole pattern, and it is shorter than any helper:
//
//	type Report struct {
//		Read  func() string
//		Parse func(string) []string
//	}
//
//	func NewReport(options ...func(*Report)) *Report {
//		r := &Report{Read: readDB, Parse: parseCSV}
//		for _, option := range options { option(r) }
//		return r
//	}
//
// Functional options are the same idea applied to any constructor — [NewHistory]
// uses them. See the README table.
