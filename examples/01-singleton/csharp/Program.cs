// Video 01 — Singleton in C#: the painful version and the fix, side by side.
//
// Run it:  cd examples/01-singleton/csharp && dotnet run
using System.Text.Json;
using GofPatterns;

// Stands in for the file on disk, so the example needs no fixtures.
var fileOnDisk = """{"currency":"MXN","retries":3}""";

// The JSON is lower case and the record is PascalCase; System.Text.Json is
// case-sensitive unless told otherwise.
var json = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

Config Load(ref int reads)
{
    reads++;
    return JsonSerializer.Deserialize<Config>(fileOnDisk, json)!;
}

// --- before -----------------------------------------------------------------
var reads = 0;
var checkout = $"charging in {Load(ref reads).Currency}";
fileOnDisk = """{"currency":"USD","retries":3}"""; // a deploy, mid-request
var refund = $"refunding in {Load(ref reads).Currency}";
Load(ref reads);

Console.WriteLine($"config leído del disco: {reads} veces");
Console.WriteLine($"  checkout: {checkout}");
Console.WriteLine($"  refund:   {refund}");
if (reads != 3 || checkout != "charging in MXN" || refund != "refunding in USD")
{
    throw new InvalidOperationException("the before case stopped reproducing the bug");
}

Console.WriteLine("⚠️  dos partes del mismo request vieron monedas distintas");

// --- after ------------------------------------------------------------------
fileOnDisk = """{"currency":"MXN","retries":3}""";
var afterReads = 0;
var config = new Singleton<Config>(() =>
{
    afterReads++;
    return JsonSerializer.Deserialize<Config>(fileOnDisk, json)!;
});

var checkout2 = $"charging in {config.Value.Currency}";
fileOnDisk = """{"currency":"USD","retries":3}""";
var refund2 = $"refunding in {config.Value.Currency}";
_ = config.Value;

Console.WriteLine();
Console.WriteLine($"config leído del disco: {afterReads} vez");
Console.WriteLine($"  checkout: {checkout2}");
Console.WriteLine($"  refund:   {refund2}");
Console.WriteLine($"  las tres llamadas ven el mismo objeto: {ReferenceEquals(config.Value, config.Value)}");
if (afterReads != 1 || refund2 != "refunding in MXN")
{
    throw new InvalidOperationException("the after case is not deduplicating the read");
}

config.Reset(); // what a static field does not give you
if (config.Value.Currency != "USD")
{
    throw new InvalidOperationException("after Reset the next read should see the current file");
}

Console.WriteLine("✅ una lectura, una sola verdad, y Reset() para los tests");

// What the README tells you to prefer when you do not need Reset.
var lazyReads = 0;
var lazyConfig = new Lazy<Config>(() =>
{
    lazyReads++;
    return JsonSerializer.Deserialize<Config>(fileOnDisk, json)!;
});
_ = lazyConfig.Value;
_ = lazyConfig.Value;
Console.WriteLine();
Console.WriteLine($"con Lazy<T>: {lazyReads} lectura (pero sin Reset)");
if (lazyReads != 1)
{
    throw new InvalidOperationException("Lazy<T> should build once");
}

internal sealed record Config(string Currency, int Retries);
