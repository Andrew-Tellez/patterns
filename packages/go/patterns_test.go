package gof_test

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"testing"

	gof "github.com/Andrew-Tellez/patterns/packages/go"
)

func TestSingletonBuildsOnceAndResets(t *testing.T) {
	calls := 0
	db := gof.NewSingleton(func() *int {
		calls++
		value := calls
		return &value
	})

	if db.Value() != db.Value() {
		t.Fatal("want the same pointer from two calls")
	}
	if calls != 1 {
		t.Fatalf("factory ran %d times, want 1", calls)
	}
	db.Reset()
	if got := *db.Value(); got != 2 {
		t.Fatalf("after Reset got %d, want 2", got)
	}
}

func TestSingletonIsSafeForConcurrentUse(t *testing.T) {
	calls := 0
	var mu sync.Mutex
	db := gof.NewSingleton(func() int {
		mu.Lock()
		calls++
		mu.Unlock()
		return 7
	})

	var wg sync.WaitGroup
	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if got := db.Value(); got != 7 {
				t.Errorf("got %d, want 7", got)
			}
		}()
	}
	wg.Wait()
	if calls != 1 {
		t.Fatalf("factory ran %d times under contention, want 1", calls)
	}
}

func TestRegistry(t *testing.T) {
	rails := gof.NewRegistry[string, func(int) string]()
	rails.Register("stripe", func(cents int) string { return fmt.Sprintf("stripe:%d", cents) })

	send, err := rails.Get("stripe")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := send(500); got != "stripe:500" {
		t.Fatalf("got %q", got)
	}
	if !rails.Has("stripe") || rails.Has("paypal") {
		t.Fatal("Has is wrong")
	}
	if keys := rails.Keys(); len(keys) != 1 || keys[0] != "stripe" {
		t.Fatalf("got keys %v", keys)
	}

	if _, err := rails.Get("paypal"); err == nil || !strings.Contains(err.Error(), "paypal") {
		t.Fatalf("want an error naming the key, got %v", err)
	}

	defer func() {
		if recover() == nil {
			t.Fatal("MustGet should panic on an unknown key")
		}
	}()
	rails.MustGet("paypal")
}

func TestCloneIsDeep(t *testing.T) {
	type inner struct{ Value int }
	type box struct{ Inner *inner }

	original := box{Inner: &inner{Value: 1}}
	copied, err := gof.Clone(original)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	copied.Inner.Value = 2
	if original.Inner.Value != 1 {
		t.Fatal("Clone was shallow")
	}
}

func TestCloneReportsWhatJSONCannotCarry(t *testing.T) {
	if _, err := gof.Clone(func() {}); err == nil {
		t.Fatal("want an error for a func, got nil")
	}
}

func TestBuilderAppliesConditionalSteps(t *testing.T) {
	type query struct{ Table, User string }

	got := gof.NewBuilder(query{}).
		With(func(q query) query { q.Table = "orders"; return q }).
		WithIf(true, func(q query) query { q.User = "u1"; return q }).
		WithIf(false, func(q query) query { q.Table = "never"; return q }).
		Build()

	if got != (query{Table: "orders", User: "u1"}) {
		t.Fatalf("got %+v", got)
	}
}

func TestAdaptAndDecorate(t *testing.T) {
	type legacy struct{}
	send := gof.Adapt(legacy{}, func(legacy) func(string) string {
		return func(message string) string { return "sent:" + message }
	})
	if got := send("hi"); got != "sent:hi" {
		t.Fatalf("got %q", got)
	}

	var order []string
	call := gof.Decorate(
		func(n int) string { return fmt.Sprintf("core:%d", n) },
		func(next func(int) string) func(int) string {
			return func(n int) string { order = append(order, "outer"); return next(n) }
		},
		func(next func(int) string) func(int) string {
			return func(n int) string { order = append(order, "inner"); return next(n) }
		},
	)
	if got := call(1); got != "core:1" {
		t.Fatalf("got %q", got)
	}
	if strings.Join(order, ",") != "outer,inner" {
		t.Fatalf("wrappers ran %v, want outer then inner", order)
	}

	plain := func(n int) int { return n }
	if got := gof.Decorate(plain)(3); got != 3 {
		t.Fatalf("no wrappers should pass through, got %d", got)
	}
}

func TestComposite(t *testing.T) {
	child := gof.NewComposite(5.0)
	root := gof.NewComposite(10.0, child, gof.NewComposite(1.0))

	if got := root.Sum(func(v float64) float64 { return v }); got != 16 {
		t.Fatalf("got %v, want 16", got)
	}
	if root.Size() != 3 {
		t.Fatalf("got size %d, want 3", root.Size())
	}
	if !root.Remove(child) {
		t.Fatal("Remove should report true for a present child")
	}
	if got := root.Sum(func(v float64) float64 { return v }); got != 11 {
		t.Fatalf("after Remove got %v, want 11", got)
	}
	if root.Remove(child) {
		t.Fatal("Remove should report false the second time")
	}

	empty := gof.NewComposite("a")
	if len(empty.Children()) != 0 {
		t.Fatal("a new node should have no children")
	}
	if empty.Add(gof.NewComposite("b")) != empty {
		t.Fatal("Add should return the receiver so calls chain")
	}
}

func TestCompositeWalkIsLazyAndDepthFirst(t *testing.T) {
	root := gof.NewComposite("a", gof.NewComposite("b", gof.NewComposite("c")))

	var seen []string
	for node := range root.Walk() {
		seen = append(seen, node.Value)
	}
	if strings.Join(seen, ",") != "a,b,c" {
		t.Fatalf("got %v, want depth-first a,b,c", seen)
	}

	visited := 0
	for node := range root.Walk() {
		visited++
		if node.Value == "b" {
			break
		}
	}
	if visited != 2 {
		t.Fatalf("break visited %d nodes, want 2 — the walk is not lazy", visited)
	}
}

func TestFlyweight(t *testing.T) {
	built := 0
	types := gof.NewFlyweight(func(name string) *string {
		built++
		return &name
	})

	if types.Get("oak") != types.Get("oak") {
		t.Fatal("want the same pointer for the same key")
	}
	if built != 1 {
		t.Fatalf("factory ran %d times, want 1", built)
	}
	if types.Get("oak") == types.Get("pine") {
		t.Fatal("different keys must not share")
	}
	if types.Len() != 2 {
		t.Fatalf("got Len %d, want 2", types.Len())
	}
	types.Clear()
	if types.Len() != 0 {
		t.Fatal("Clear did not empty the cache")
	}
}

func TestBridgeKeepsTheReferenceStableAcrossASwap(t *testing.T) {
	type store struct{ Save func(string) string }
	s3 := func(key string) string { return "s3:" + key }
	disk := func(key string) string { return "disk:" + key }

	bridge := gof.NewBridge(func(impl func(string) string) store {
		return store{Save: impl}
	}, s3)

	captured := bridge // a caller that keeps the reference
	if got := captured.API().Save("a"); got != "s3:a" {
		t.Fatalf("got %q", got)
	}
	bridge.Swap(disk)
	if got := captured.API().Save("a"); got != "disk:a" {
		t.Fatalf("after Swap got %q, want disk:a", got)
	}
}

func TestChain(t *testing.T) {
	route := gof.Chain([]func(int, func() string) string{
		func(level int, next func() string) string {
			if level == 1 {
				return "bot"
			}
			return next()
		},
		func(level int, next func() string) string {
			if level == 2 {
				return "human"
			}
			return next()
		},
	}, func(int) string { return "queue" })

	for level, want := range map[int]string{1: "bot", 2: "human", 9: "queue"} {
		got, err := route(level)
		if err != nil {
			t.Fatalf("level %d: unexpected error %v", level, err)
		}
		if got != want {
			t.Fatalf("level %d: got %q, want %q", level, got, want)
		}
	}

	_, err := gof.Chain[int, string](nil, nil)(1)
	if !errors.Is(err, gof.ErrNoHandler) {
		t.Fatalf("want ErrNoHandler, got %v", err)
	}
}

func TestCommandBus(t *testing.T) {
	var cart []string
	bus := gof.NewCommandBus()
	add := func(sku string) bool {
		return gof.Run(bus, gof.Command[bool]{
			Execute: func() bool { cart = append(cart, sku); return true },
			Undo:    func() { cart = cart[:len(cart)-1] },
		})
	}

	add("book")
	add("mug")
	if strings.Join(cart, ",") != "book,mug" {
		t.Fatalf("got %v", cart)
	}
	if !bus.Undo() || strings.Join(cart, ",") != "book" {
		t.Fatalf("after Undo got %v", cart)
	}
	if !bus.Redo() || strings.Join(cart, ",") != "book,mug" {
		t.Fatalf("after Redo got %v", cart)
	}
	if bus.CanRedo() {
		t.Fatal("Redo should have emptied the future")
	}

	empty := gof.NewCommandBus()
	if empty.CanUndo() || empty.CanRedo() || empty.Undo() || empty.Redo() {
		t.Fatal("an empty bus should report and do nothing")
	}
	if got := gof.Run(empty, gof.Command[int]{Execute: func() int { return 42 }}); got != 42 {
		t.Fatalf("got %d", got)
	}
	if empty.CanUndo() {
		t.Fatal("a command with no Undo must not be tracked")
	}
}

func TestSubjectAllowsUnsubscribingDuringEmit(t *testing.T) {
	var seen []int
	var subject gof.Subject[int]
	var off func()
	off = subject.Subscribe(func(n int) { seen = append(seen, n); off() })
	subject.Subscribe(func(n int) { seen = append(seen, n*10) })

	subject.Emit(1)
	subject.Emit(2)

	if fmt.Sprint(seen) != "[1 10 20]" {
		t.Fatalf("got %v, want [1 10 20]", seen)
	}
	if subject.Len() != 1 {
		t.Fatalf("got Len %d, want 1", subject.Len())
	}
	off() // unsubscribing twice must not panic
}

func TestMediatorKeepsTypedChannelsSeparate(t *testing.T) {
	login := gof.NewChannel[string]("login")
	logout := gof.NewChannel[int]("logout")
	hub := gof.NewMediator()

	var seen []string
	gof.On(hub, login, func(id string) { seen = append(seen, id) })
	off := gof.On(hub, logout, func(int) { seen = append(seen, "out") })

	gof.Emit(hub, login, "u1")
	gof.Emit(hub, logout, 0)
	off()
	gof.Emit(hub, logout, 0)

	if strings.Join(seen, ",") != "u1,out" {
		t.Fatalf("got %v", seen)
	}
	if login.Name != "login" {
		t.Fatalf("got name %q", login.Name)
	}
}

func TestHistory(t *testing.T) {
	history := gof.NewHistory("")
	if history.CanUndo() || history.Redo() {
		t.Fatal("a fresh history has nowhere to go")
	}

	history.Save("a")
	history.Save("ab")
	if !history.Undo() || history.Current() != "a" {
		t.Fatalf("after Undo got %q", history.Current())
	}
	if !history.Redo() || history.Current() != "ab" {
		t.Fatalf("after Redo got %q", history.Current())
	}
	history.Undo()
	history.Save("ax")
	if history.CanRedo() {
		t.Fatal("Save should drop the redo future")
	}
	if history.Current() != "ax" {
		t.Fatalf("got %q", history.Current())
	}
}

func TestHistoryOptions(t *testing.T) {
	limited := gof.NewHistory(0, gof.WithLimit[int](1))
	limited.Save(1)
	limited.Save(2)
	if !limited.Undo() || limited.Current() != 1 {
		t.Fatalf("got %d", limited.Current())
	}
	if limited.CanUndo() {
		t.Fatal("the limit should have dropped the oldest state")
	}

	mutable := []string{""}
	deep := gof.NewHistory(mutable, gof.WithSnapshot(func(s []string) []string {
		return append([]string(nil), s...)
	}))
	deep.Save(mutable)
	mutable[0] = "mutated"
	deep.Undo()
	if deep.Current()[0] != "" {
		t.Fatalf("the snapshot did not protect the history: %v", deep.Current())
	}
}

func TestStateMachine(t *testing.T) {
	order := gof.NewStateMachine("draft", map[string]map[string]string{
		"draft": {"pay": "paid"},
		"paid":  {"ship": "sent"},
		"sent":  {},
	})

	var audit []string
	order.Changes.Subscribe(func(c gof.Change[string, string]) {
		audit = append(audit, fmt.Sprintf("%s: %s -> %s", c.Event, c.From, c.To))
	})

	if order.Can("ship") {
		t.Fatal("ship must not be allowed in draft")
	}
	if state, err := order.Send("pay"); err != nil || state != "paid" {
		t.Fatalf("got %q, %v", state, err)
	}
	if state := order.MustSend("ship"); state != "sent" {
		t.Fatalf("got %q", state)
	}
	if strings.Join(audit, " | ") != "pay: draft -> paid | ship: paid -> sent" {
		t.Fatalf("got audit %v", audit)
	}

	if _, err := order.Send("pay"); err == nil || !strings.Contains(err.Error(), "sent") {
		t.Fatalf("want an error naming the state, got %v", err)
	}
	if order.State() != "sent" {
		t.Fatalf("a refused event changed the state to %q", order.State())
	}
}

func TestStateMachineWithNamedTypes(t *testing.T) {
	type status string
	machine := gof.NewStateMachine(status("draft"), map[status]map[string]status{
		"draft": {"pay": status("paid")},
		"paid":  {},
	})
	if got := machine.MustSend("pay"); got != status("paid") {
		t.Fatalf("got %q", got)
	}

	defer func() {
		if recover() == nil {
			t.Fatal("MustSend should panic on an illegal transition")
		}
	}()
	machine.MustSend("pay")
}

func TestVisitor(t *testing.T) {
	area := gof.Visitor(
		func(node map[string]any) string { return node["type"].(string) },
		map[string]func(map[string]any) float64{
			"square": func(node map[string]any) float64 { return node["side"].(float64) * node["side"].(float64) },
			"circle": func(node map[string]any) float64 { return math.Pi * node["r"].(float64) * node["r"].(float64) },
		},
		nil,
	)

	got, err := area(map[string]any{"type": "square", "side": 3.0})
	if err != nil || got != 9 {
		t.Fatalf("got %v, %v", got, err)
	}
	if _, err := area(map[string]any{"type": "hexagon"}); err == nil || !strings.Contains(err.Error(), "hexagon") {
		t.Fatalf("want an error naming the tag, got %v", err)
	}

	withFallback := gof.Visitor(
		func(node map[string]any) string { return node["type"].(string) },
		map[string]func(map[string]any) float64{},
		func(map[string]any) float64 { return -1 },
	)
	if got, err := withFallback(map[string]any{"type": "x"}); err != nil || got != -1 {
		t.Fatalf("got %v, %v", got, err)
	}
}

func TestIterateWalksAnExternalCursorLazily(t *testing.T) {
	rows := []string{"a", "b", "c"}
	i := 0
	var pulled []string
	cursor := gof.Iterate(
		func() bool { return i < len(rows) },
		func() string { pulled = append(pulled, rows[i]); i++; return rows[i-1] },
	)

	for row := range cursor {
		if row == "b" {
			break
		}
	}
	if strings.Join(pulled, ",") != "a,b" {
		t.Fatalf("pulled %v, want a,b — never c", pulled)
	}

	i, pulled = 0, nil
	var all []string
	for row := range gof.Iterate(func() bool { return i < len(rows) }, func() string { i++; return rows[i-1] }) {
		all = append(all, row)
	}
	if strings.Join(all, ",") != "a,b,c" {
		t.Fatalf("got %v", all)
	}

	empty := gof.Iterate(func() bool { return false }, func() int { return 0 })
	for range empty {
		t.Fatal("an exhausted cursor must yield nothing")
	}
}

func TestMustGetReturnsTheFactoryWhenTheKeyExists(t *testing.T) {
	rails := gof.NewRegistry[string, func() string]()
	rails.Register("spei", func() string { return "spei" })
	if got := rails.MustGet("spei")(); got != "spei" {
		t.Fatalf("got %q", got)
	}
}

func TestHistoryUndoOnAnEmptyPast(t *testing.T) {
	if gof.NewHistory("a").Undo() {
		t.Fatal("Undo on a fresh history should report false")
	}
}

// asymmetric marshals to a JSON string but decodes as a struct, so the round-trip
// inside Clone fails on the way back. It is contrived, but it is the shape of a
// real bug: a type whose MarshalJSON and UnmarshalJSON disagree.
type asymmetric struct{ Value int }

func (asymmetric) MarshalJSON() ([]byte, error) { return []byte(`"not an object"`), nil }

func TestCloneReportsADecodeFailure(t *testing.T) {
	_, err := gof.Clone(asymmetric{Value: 1})
	if err == nil || !strings.Contains(err.Error(), "decode") {
		t.Fatalf("want a decode error, got %v", err)
	}
}
