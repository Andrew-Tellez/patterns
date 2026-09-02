# Video 04 — Decorator

**Duración objetivo:** 9-11 minutos
**Patrón:** Decorator — `decorate()` en TypeScript y en Python

---

## Gancho (0:00 - 0:45)

> "El proveedor de pagos devuelve 502 de vez en cuando, así que alguien le puso reintentos.
> Fíjate en el log. Un cobro, **tres líneas de log**. Y en tu dashboard eso se ve como tres
> intentos de cobro, no como uno que tardó. Ese es el bug del video, y es de orden, no de
> lógica."

Corre `before.ts`. Que se vean las tres líneas de log para un solo cobro.

---

## El problema (0:45 - 3:00)

1. **El reintento y el log están enredados.** Señala que el `try/catch` y el `logger.info`
   están en el mismo bucle. No hay forma de cambiar uno sin leer el otro.
2. **Está copiado.** Señala `charge()` y `refund()`: el mismo bucle, dos veces, y ya divergen —
   uno reintenta 3 veces y el otro 2, y nadie decidió eso.
3. **El orden es un accidente.** El log quedó dentro del bucle porque ahí se escribió, no
   porque alguien lo decidiera. Y no hay ningún lugar donde ese orden se pueda ver.

---

## La solución, tecleada (3:00 - 7:00)

### Paso 1 — saca las capas

Teclea `withLog` primero, porque es la más simple:

```ts
const withLog = (next: Charge): Charge => async (cents) => {
  log.push(`charging ${cents}`);
  return next(cents);
};
```

> "Recibe la función de adentro y devuelve una función con la misma forma. Eso es todo lo que
> es un wrapper."

Ahora `withRetry`, que sí tiene lógica:

```ts
const withRetry = (times: number) => (next: Charge): Charge => async (cents) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await next(cents);
    } catch (error) {
      if (attempt >= times) throw error;
    }
  }
};
```

> "Fíjate que `withRetry` no sabe nada de pagos. Sirve para cualquier función que reciba algo
> y devuelva una promesa. Eso es lo que ganas al separarlo."

### Paso 2 — compón

```ts
const charge = decorate(rawCharge, withLog, withRetry(3));
```

> "Se lee en el orden en que corre: primero el log, luego los reintentos, luego el cobro real."

### Paso 3 — córrelo

**Una línea de log, tres intentos.** Ese es el momento del video.

### Paso 4 — invierte los argumentos, a propósito

Esta es la mejor parte. Cambia el orden en vivo:

```ts
const noisy = decorate(rawCharge, withRetry(3), withLog);
```

Córrelo: **tres líneas de log.**

> "El mismo código, los argumentos al revés, y volvió el bug original. Y eso es justo el punto:
> el orden dejó de ser un accidente enterrado en un bucle y se volvió algo que se ve en una
> línea. Ahora es una decisión, y se puede revisar en un PR."

---

## El pago real (7:00 - 8:30)

> "Y ahora lo que de verdad compra esto."

Aplica las mismas capas a `refund`:

```ts
const refund = decorate(rawRefund, withLog, withRetry(3));
```

> "Cero código nuevo. Y las dos funciones ahora reintentan igual, porque el número está en un
> solo lugar."

---

## Cuándo NO usarlo (8:30 - 9:15)

> "Una capa sobre una función es solo una función que llama a otra: no necesitas el helper.
> Esto paga a partir de dos capas, o cuando las mismas capas aplican a varias funciones."

**En Python agrega:**

> "Y en Python, si la capa es fija y la función es tuya, un decorador con `@` es más idiomático.
> `decorate` es para cuando compones en runtime — cuando el número de reintentos viene de la
> config, o cuando envuelves algo que no escribiste."

---

## Notas de grabación

- El contraste visual del video son las **líneas de log en la terminal**: 3 → 1 → 3. Deja la
  terminal grande.
- El paso 4 es el que hace que entiendan el patrón. No te lo brinques por tiempo.
- En Python `decorate` aplica `functools.wraps`, así que el nombre y el docstring sobreviven.
  Muéstralo: `print(charge.__name__)`.
