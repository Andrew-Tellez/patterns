import type { PatternScript } from '../types';

/**
 * The code here is a condensed version of examples/01-singleton, short enough to
 * stay readable at video size. The terminal output is copied from an actual run of
 * those files, not invented.
 */
export const singletonTypeScript: PatternScript = {
  title: 'Singleton',
  subtitle: 'Una instancia perezosa y compartida — y por qué reset() salva tus tests',
  language: 'TypeScript',
  fileName: 'config.ts',
  problem: {
    command: 'node examples/01-singleton/before.ts',
    lines: [
      'config leído del disco: 3 veces',
      '  checkout: charging in MXN',
      '  refund:   refunding in USD',
      '⚠️  dos partes del mismo request vieron monedas distintas',
    ],
    verdict: 'bad',
  },
  steps: [
    {
      caption: 'Tres llamadores piden la config. Nadie hizo nada mal, y el disco se lee tres veces.',
      seconds: 7,
      code: `function loadConfig(): Config {
  reads += 1;
  return JSON.parse(fileOnDisk);
}

const checkout = \`charging in \${loadConfig().currency}\`;
const refund = \`refunding in \${loadConfig().currency}\`;`,
    },
    {
      caption: 'Una función. No una clase, no un decorador, no un contenedor de inyección.',
      seconds: 6,
      code: `import { singleton } from 'gof-patterns';

function loadConfig(): Config {
  reads += 1;
  return JSON.parse(fileOnDisk);
}

const checkout = \`charging in \${loadConfig().currency}\`;
const refund = \`refunding in \${loadConfig().currency}\`;`,
    },
    {
      caption: 'loadConfig no cambia: decide QUÉ cargar. singleton decide CUÁNDO se llama.',
      seconds: 8,
      code: `import { singleton } from 'gof-patterns';

function loadConfig(): Config {
  reads += 1;
  return JSON.parse(fileOnDisk);
}

const config = singleton(loadConfig);

const checkout = \`charging in \${loadConfig().currency}\`;
const refund = \`refunding in \${loadConfig().currency}\`;`,
    },
    {
      caption: 'Ahora los call sites. loadConfig() a config(). Tres caracteres menos por lado.',
      seconds: 7,
      code: `import { singleton } from 'gof-patterns';

function loadConfig(): Config {
  reads += 1;
  return JSON.parse(fileOnDisk);
}

const config = singleton(loadConfig);

const checkout = \`charging in \${config().currency}\`;
const refund = \`refunding in \${config().currency}\`;`,
    },
    {
      caption: 'Y esto es lo que un singleton hecho a mano no te da: tests que no heredan estado.',
      seconds: 8,
      code: `import { singleton } from 'gof-patterns';

function loadConfig(): Config {
  reads += 1;
  return JSON.parse(fileOnDisk);
}

const config = singleton(loadConfig);

const checkout = \`charging in \${config().currency}\`;
const refund = \`refunding in \${config().currency}\`;

config.reset(); // los tests empiezan limpios`,
    },
  ],
  outcome: {
    command: 'node examples/01-singleton/after.ts',
    lines: [
      'config leído del disco: 1 vez',
      '  checkout: charging in MXN',
      '  refund:   charging in MXN',
      '  las tres llamadas ven el mismo objeto: true',
      '✅ una lectura, una sola verdad, y reset() para los tests',
    ],
    verdict: 'good',
  },
};

export const singletonPython: PatternScript = {
  ...singletonTypeScript,
  language: 'Python',
  fileName: 'config.py',
  subtitle: 'Una instancia perezosa y compartida — y cuándo functools.cache es mejor',
  problem: {
    ...singletonTypeScript.problem,
    command: 'python3 examples/01-singleton/before.py',
  },
  steps: [
    {
      caption: 'Tres llamadores piden la config. Nadie hizo nada mal, y el disco se lee tres veces.',
      seconds: 7,
      code: `def load_config() -> dict:
    global reads
    reads += 1
    return json.loads(file_on_disk)


checkout = f"charging in {load_config()['currency']}"
refund = f"refunding in {load_config()['currency']}"`,
    },
    {
      caption: 'Un import y una línea. El resto del archivo no se toca.',
      seconds: 7,
      code: `from gof_patterns import singleton


def load_config() -> dict:
    global reads
    reads += 1
    return json.loads(file_on_disk)


config = singleton(load_config)

checkout = f"charging in {load_config()['currency']}"
refund = f"refunding in {load_config()['currency']}"`,
    },
    {
      caption: 'Cambia los call sites, y las tres partes del código ven el mismo objeto.',
      seconds: 7,
      code: `from gof_patterns import singleton


def load_config() -> dict:
    global reads
    reads += 1
    return json.loads(file_on_disk)


config = singleton(load_config)

checkout = f"charging in {config()['currency']}"
refund = f"refunding in {config()['currency']}"`,
    },
    {
      caption: 'Pero en Python, si la función es tuya, el stdlib ya lo hace. Y el README te lo dice.',
      seconds: 9,
      code: `import functools


@functools.cache
def config() -> dict:
    global reads
    reads += 1
    return json.loads(file_on_disk)


checkout = f"charging in {config()['currency']}"
refund = f"refunding in {config()['currency']}"

config.cache_clear()  # este es el reset`,
    },
  ],
  outcome: {
    command: 'python3 examples/01-singleton/after.py',
    lines: [
      'config leído del disco: 1 vez',
      '  las tres llamadas ven el mismo objeto: True',
      '✅ una lectura, y con functools.cache es lo mismo si la función es tuya',
    ],
    verdict: 'good',
  },
};

/** Terminal lines copied from `cd examples/01-singleton/go && go run .` */
export const singletonGo: PatternScript = {
  title: 'Singleton',
  subtitle: 'sync.OnceValue ya lo hace — el helper existe solo por Reset()',
  language: 'Go',
  fileName: 'config.go',
  problem: {
    command: 'cd examples/01-singleton/go && go run .',
    lines: [
      'config leído del disco: 3 veces',
      '  checkout: charging in MXN',
      '  refund:   refunding in USD',
      '⚠️  dos partes del mismo request vieron monedas distintas',
    ],
    verdict: 'bad',
  },
  steps: [
    {
      caption: 'Tres llamadores, tres lecturas. Y si el archivo cambia en medio, discrepan.',
      seconds: 7,
      code: `loadConfig := func() config {
	reads++
	var c config
	_ = json.Unmarshal([]byte(fileOnDisk), &c)
	return c
}

checkout := "charging in " + loadConfig().Currency
refund := "refunding in " + loadConfig().Currency`,
    },
    {
      caption: 'NewSingleton envuelve el factory. La función de adentro no se toca.',
      seconds: 8,
      code: `config := gof.NewSingleton(func() config {
	reads++
	var c config
	_ = json.Unmarshal([]byte(fileOnDisk), &c)
	return c
})

checkout := "charging in " + config.Value().Currency
refund := "refunding in " + config.Value().Currency`,
    },
    {
      caption: 'Value() es seguro entre goroutines: el factory corre una vez aunque compitan cincuenta.',
      seconds: 8,
      code: `config := gof.NewSingleton(func() config {
	reads++
	var c config
	_ = json.Unmarshal([]byte(fileOnDisk), &c)
	return c
})

checkout := "charging in " + config.Value().Currency
refund := "refunding in " + config.Value().Currency

config.Reset() // lo único que sync.OnceValue no te da`,
    },
    {
      caption: 'Y si la función es tuya y no necesitas Reset, el stdlib gana. El README te lo dice.',
      seconds: 9,
      code: `// sync.OnceValue: perezoso, una sola vez, seguro entre goroutines
loadConfig := sync.OnceValue(func() config {
	reads++
	var c config
	_ = json.Unmarshal([]byte(fileOnDisk), &c)
	return c
})

loadConfig()
loadConfig() // una lectura`,
    },
  ],
  outcome: {
    command: 'cd examples/01-singleton/go && go run .',
    lines: [
      'config leído del disco: 1 vez',
      '  las tres llamadas ven el mismo valor: true',
      'con sync.OnceValue: 1 lectura (pero sin Reset)',
      '✅ una lectura, una sola verdad, y Reset() para los tests',
    ],
    verdict: 'good',
  },
};

/** Terminal lines copied from `cd examples/01-singleton/csharp && dotnet run` */
export const singletonCSharp: PatternScript = {
  title: 'Singleton',
  subtitle: 'Lazy<T> ya lo hace — el helper existe solo por Reset()',
  language: 'C#',
  fileName: 'Program.cs',
  problem: {
    command: 'cd examples/01-singleton/csharp && dotnet run',
    lines: [
      'config leído del disco: 3 veces',
      '  checkout: charging in MXN',
      '  refund:   refunding in USD',
      '⚠️  dos partes del mismo request vieron monedas distintas',
    ],
    verdict: 'bad',
  },
  steps: [
    {
      caption: 'Tres llamadores, tres deserializaciones. Y si el archivo cambia, discrepan.',
      seconds: 7,
      code: `Config Load()
{
    reads++;
    return JsonSerializer.Deserialize<Config>(fileOnDisk, json)!;
}

var checkout = $"charging in {Load().Currency}";
var refund = $"refunding in {Load().Currency}";`,
    },
    {
      caption: 'Singleton<T> recibe el factory. Value construye la primera vez y comparte después.',
      seconds: 8,
      code: `var config = new Singleton<Config>(() =>
{
    reads++;
    return JsonSerializer.Deserialize<Config>(fileOnDisk, json)!;
});

var checkout = $"charging in {config.Value.Currency}";
var refund = $"refunding in {config.Value.Currency}";`,
    },
    {
      caption: 'Y Reset() es la razón de existir del helper: sin él, tus tests heredan estado.',
      seconds: 8,
      code: `var config = new Singleton<Config>(() =>
{
    reads++;
    return JsonSerializer.Deserialize<Config>(fileOnDisk, json)!;
});

var checkout = $"charging in {config.Value.Currency}";
var refund = $"refunding in {config.Value.Currency}";

config.Reset(); // lo único que Lazy<T> no te da`,
    },
    {
      caption: 'Si no necesitas Reset, usa Lazy<T>. Es del BCL, es thread-safe, y es una línea.',
      seconds: 9,
      code: `// Lazy<T>: perezoso, una sola vez, thread-safe por default
var config = new Lazy<Config>(() =>
    JsonSerializer.Deserialize<Config>(fileOnDisk, json)!);

var checkout = $"charging in {config.Value.Currency}";
var refund = $"refunding in {config.Value.Currency}";`,
    },
  ],
  outcome: {
    command: 'cd examples/01-singleton/csharp && dotnet run',
    lines: [
      'config leído del disco: 1 vez',
      '  las tres llamadas ven el mismo objeto: True',
      'con Lazy<T>: 1 lectura (pero sin Reset)',
      '✅ una lectura, una sola verdad, y Reset() para los tests',
    ],
    verdict: 'good',
  },
};

/**
 * Kotlin is the odd one out, and that is the video: the package ships **no**
 * singleton helper, because `object` and `by lazy` are shorter than any helper and
 * checked by the compiler. The closing terminal line is real output from
 * `./gradlew test` in packages/kotlin.
 */
export const singletonKotlin: PatternScript = {
  title: 'Singleton',
  subtitle: 'El único video donde la respuesta es: no uses la librería',
  language: 'Kotlin',
  fileName: 'Config.kt',
  problem: {
    command: 'wc -l ConfigLoader.kt   # el singleton hecho a mano',
    lines: [
      '      11 ConfigLoader.kt',
      '⚠️  11 líneas de ceremonia para una instancia perezosa',
    ],
    verdict: 'bad',
  },
  steps: [
    {
      caption: 'Esto es lo que la gente porta de Java: doble verificación, @Volatile, synchronized.',
      seconds: 9,
      code: `class ConfigLoader private constructor() {
    companion object {
        @Volatile
        private var instance: ConfigLoader? = null

        fun getInstance(): ConfigLoader =
            instance ?: synchronized(this) {
                instance ?: ConfigLoader().also { instance = it }
            }
    }
}`,
    },
    {
      caption: 'Kotlin ya trae esto en el lenguaje. Bórralo todo.',
      seconds: 7,
      code: `object ConfigLoader {
    val config: Config by lazy { loadConfig() }
}`,
    },
    {
      caption: 'object es una instancia única, inicializada una vez y thread-safe. Sin ceremonia.',
      seconds: 8,
      code: `object ConfigLoader {
    val config: Config by lazy { loadConfig() }
}

// tres líneas contra once, y el compilador garantiza la unicidad`,
    },
    {
      caption: 'Y por eso el paquete de Kotlin no trae singleton: envolver esto lo empeoraría.',
      seconds: 9,
      code: `object ConfigLoader {
    val config: Config by lazy { loadConfig() }
}

// El README de Kotlin lo dice en la tabla del catálogo:
//   Singleton | object Config { ... } | la construcción del lenguaje
//
// 10 de los 22 patrones son features de Kotlin. Envolverlos
// sería más código para leer, no menos.`,
    },
  ],
  outcome: {
    command: "./gradlew test --tests '*CreationalTest*'",
    lines: [
      'CreationalTest > object declaration is the singleton, no helper needed() PASSED',
      '✅ 3 líneas, y la librería te dice cuándo NO la necesitas',
    ],
    verdict: 'good',
  },
};
