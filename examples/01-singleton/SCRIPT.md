# Video 01 — Singleton

**Duración objetivo:** 8-10 minutos
**Patrón:** Singleton — `singleton()` en TypeScript, `singleton()` en Python
**Archivos:** `before.ts`, `after.ts`, `before.py`, `after.py`

---

## Gancho (0:00 - 0:40)

> "Este handler lee un archivo de configuración. Se ve bien. Y en producción va a leer ese
> archivo cinco veces por request, va a parsear el JSON cinco veces, y en el peor caso dos
> partes de tu código van a estar viendo configuraciones distintas al mismo tiempo. Vamos a
> verlo pasar, y luego lo arreglamos con una línea."

Abre `before.ts` en pantalla. No lo expliques todavía — córrelo.

```bash
node examples/01-singleton/before.ts
```

Que se vea la salida: **`config leído del disco: 3 veces`**.

---

## El problema (0:40 - 3:00)

Recorre el archivo señalando tres cosas, en este orden:

1. **`loadConfig()` lee y parsea en cada llamada.** Señala el contador `reads`. No es un
   contador artificial: es la cuenta real de veces que se tocó el disco.
2. **Tres llamadas distintas, tres lecturas.** Señala `handleCheckout`, `handleRefund` y
   `logStartup`. Ninguno sabe de los otros. Nadie hizo nada mal.
3. **El bug que no se ve.** Señala la línea que muta el archivo entre lecturas.

> "Y aquí está lo que de verdad duele: si el archivo cambia entre dos lecturas —un deploy, un
> feature flag, alguien tocando el ConfigMap— `handleCheckout` y `handleRefund` están operando
> con configuraciones distintas dentro del mismo request. Ese bug no aparece en tu máquina.
> Aparece a las 3 de la mañana."

---

## La solución, tecleada (3:00 - 6:30)

**No pegues el archivo terminado.** Empieza desde `before.ts` y transfórmalo en vivo. Son
cuatro pasos.

### Paso 1 — importa el helper

Arriba del archivo, teclea:

```ts
import { singleton } from 'gof-patterns';
```

> "Una función. No una clase, no un decorador, no un contenedor de inyección de dependencias."

### Paso 2 — envuelve la función que ya tienes

Esta es la línea que importa. Debajo de `loadConfig`, teclea:

```ts
const config = singleton(loadConfig);
```

> "`loadConfig` no cambia. Sigue leyendo el disco, sigue parseando, sigue siendo testeable
> sola. `singleton` solo decide *cuándo* se llama."

### Paso 3 — cambia los tres call sites

Reemplaza cada `loadConfig()` por `config()`. Hazlo uno por uno, en pantalla, y ve diciendo:

> "`loadConfig()`... a `config()`. Otra vez. Y la tercera."

Son tres caracteres menos en cada lado. Que se vea lo pequeño que es el diff.

### Paso 4 — córrelo

```bash
node examples/01-singleton/after.ts
```

Que se vea: **`config leído del disco: 1 vez`** y **`las tres llamadas ven el mismo objeto: true`**.

> "Una lectura. Y las tres partes del código están viendo literalmente el mismo objeto, así
> que ya no pueden discrepar."

---

## El detalle que casi nadie enseña (6:30 - 8:30)

Teclea el bloque del test:

```ts
config.reset();
```

> "Este es el motivo por el que un singleton hecho a mano te arruina los tests. Si guardas la
> instancia en una variable global, tu segundo test hereda el estado del primero, y acabas
> con tests que pasan solos y fallan juntos. `reset()` la tira."

Corre el test dos veces para mostrar que es determinista.

**En Python di esto además:**

> "Ojo, en Python casi no necesitas nuestro helper: `functools.cache` sobre una función sin
> argumentos hace exactamente esto, y `cache_clear()` es el `reset`. Nuestro `singleton`
> existe para cuando el factory te llega en runtime y no es una función tuya que puedas
> decorar. El README lo dice explícitamente — y esa es la idea: la librería te avisa cuándo
> **no** la necesitas."

---

## Cierre (8:30 - 9:30)

> "Tres cosas que te llevas. Una: si una función es cara y siempre devuelve lo mismo, es un
> singleton, la reconozcas o no. Dos: el patrón no es la clase con constructor privado que te
> enseñaron, es *una instancia perezosa y compartida* — y en un lenguaje con funciones de
> primera clase eso es una línea. Y tres: si no puedes resetearlo, tus tests van a pagar la
> cuenta."

Cierra mostrando el diff completo: `git diff --stat` sobre el archivo. Cuatro líneas.

---

## Notas de grabación

- Ten `before.ts` y `after.ts` en pestañas separadas, pero **teclea** en la de `before`. La de
  `after` es tu red por si algo se rompe en vivo.
- La salida del contador es la prueba visual de todo el video. Que la terminal quede visible.
- Si grabas la versión de Python, el guion es idéntico salvo el paso 4 del cierre: ahí compara
  con `functools.cache` en vez de hablar de `reset()`.
- No expliques qué es un patrón de diseño. Quien está viendo esto ya buscó "singleton".
