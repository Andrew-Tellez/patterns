// Video 01 — Singleton in Go: the painful version and the fix, side by side.
//
// Run it:  cd examples/01-singleton/go && go run .
package main

import (
	"encoding/json"
	"fmt"
	"sync"

	gof "github.com/Andrew-Tellez/patterns/packages/go"
)

type config struct {
	Currency string `json:"currency"`
	Retries  int    `json:"retries"`
}

// Stands in for the file on disk, so the example needs no fixtures.
var fileOnDisk = `{"currency":"MXN","retries":3}`

func main() {
	before()
	fmt.Println()
	after()
	fmt.Println()
	stdlib()
}

func before() {
	reads := 0
	loadConfig := func() config {
		reads++
		var c config
		_ = json.Unmarshal([]byte(fileOnDisk), &c)
		return c
	}

	checkout := "charging in " + loadConfig().Currency
	fileOnDisk = `{"currency":"USD","retries":3}` // a deploy, mid-request
	refund := "refunding in " + loadConfig().Currency
	loadConfig()

	fmt.Printf("config leído del disco: %d veces\n", reads)
	fmt.Printf("  checkout: %s\n", checkout)
	fmt.Printf("  refund:   %s\n", refund)
	if checkout == "charging in MXN" && refund == "refunding in USD" && reads == 3 {
		fmt.Println("⚠️  dos partes del mismo request vieron monedas distintas")
	} else {
		panic("the before case stopped reproducing the bug")
	}
}

func after() {
	fileOnDisk = `{"currency":"MXN","retries":3}`
	reads := 0
	config := gof.NewSingleton(func() config {
		reads++
		var c config
		_ = json.Unmarshal([]byte(fileOnDisk), &c)
		return c
	})

	checkout := "charging in " + config.Value().Currency
	fileOnDisk = `{"currency":"USD","retries":3}`
	refund := "refunding in " + config.Value().Currency
	config.Value()

	fmt.Printf("config leído del disco: %d vez\n", reads)
	fmt.Printf("  checkout: %s\n", checkout)
	fmt.Printf("  refund:   %s\n", refund)
	fmt.Printf("  las tres llamadas ven el mismo valor: %v\n", config.Value() == config.Value())
	if reads != 1 || refund != "refunding in MXN" {
		panic("the after case is not deduplicating the read")
	}

	config.Reset() // what a hand-rolled singleton does not give you
	if reads != 1 {
		panic("Reset should not build eagerly")
	}
	if config.Value().Currency != "USD" {
		panic("after Reset the next read should see the current file")
	}
	fmt.Println("✅ una lectura, una sola verdad, y Reset() para los tests")
}

// What the README tells you to prefer when the function is yours.
func stdlib() {
	reads := 0
	loadConfig := sync.OnceValue(func() config {
		reads++
		var c config
		_ = json.Unmarshal([]byte(fileOnDisk), &c)
		return c
	})

	loadConfig()
	loadConfig()
	fmt.Printf("con sync.OnceValue: %d lectura (pero sin Reset)\n", reads)
	if reads != 1 {
		panic("OnceValue should run once")
	}
}
