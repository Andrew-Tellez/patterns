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
