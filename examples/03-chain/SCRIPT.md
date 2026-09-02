# Video 03 — Chain of Responsibility

**Duración objetivo:** 8-10 minutos
**Patrón:** Chain of Responsibility — `chain()` en TypeScript y en Python

---

## Gancho (0:00 - 0:40)

> "Un endpoint de webhook, tres proveedores de pago, y cada uno manda el monto en un formato
> distinto. Mira este `if/else if`. Ahora mira lo que pasa cuando llega un cuarto proveedor
> que nadie contempló: el monto se normaliza a **cero pesos** y el webhook responde 200. Sin
> error. Sin log."

Corre `before.ts`. Que se vea: **`paypal → 0 centavos`**.

---

## El problema (0:40 - 3:00)

1. **La escalera crece hacia abajo.** Señala que cada proveedor nuevo es otro `else if` en la
   *misma* función. Tres personas tocando el mismo archivo, tres conflictos de merge.
2. **El `else` final es una mentira.** `return { cents: 0 }` es lo que hace que un pago
   desconocido se registre como gratis. Nadie lo escribió con mala intención: lo escribió para
   que TypeScript dejara de quejarse.
3. **No se puede probar por partes.** Para testear la rama de SPEI tienes que construir un
   payload completo y pasar por las dos ramas anteriores.

---

## La solución, tecleada (3:00 - 6:30)

### Paso 1 — el import

```ts
import { chain } from 'gof-patterns';
```

### Paso 2 — un handler por proveedor

Convierte el primer `if` en un handler, en pantalla:

```ts
const fromStripe = (e: Incoming, next: () => Amount): Amount =>
  e.source === 'stripe' ? { cents: e.data!.total! } : next();
```

> "La firma es lo único que hay que entender: recibe la petición y recibe `next`. O contesta,
> o llama a `next` y le pasa el turno al siguiente."

Convierte el segundo. Ya se ve el patrón; ve más rápido.

### Paso 3 — el arreglo, y el fallback

```ts
const normalize = chain<Incoming, Amount>([fromStripe, fromSpei], (e) => {
  throw new Error(`unknown source: ${e.source}`);
});
```

Detente en el fallback:

> "Aquí está la parte importante del video. El `else` que devolvía cero ahora es un fallback
> **explícito**, y decidí que truene. Un pago que no sé interpretar es un error, no cero pesos.
> Antes esa decisión estaba escondida en un `return` al final de una escalera. Ahora es un
> argumento, y se ve."

### Paso 4 — agrega el cuarto proveedor

Esto es el cierre del argumento. Teclea un handler nuevo y agrégalo al arreglo:

```ts
const fromPaypal = (e: Incoming, next: () => Amount): Amount =>
  e.source === 'paypal' ? { cents: Math.round(e.gross! * 100) } : next();
```

> "Una función nueva y una entrada en el arreglo. No abrí la función que ya funcionaba. Eso es
> lo que compra el patrón."

---

## El bonus que sí usarás (6:30 - 8:00)

> "Y funciona igual con async, porque `Res` puede ser una promesa. Mismo helper, sin una
> versión 'async' aparte."

Muestra el bloque async del archivo. Es el caso que de verdad vas a tener en producción
—consultar el proveedor, pegarle a la base— y no requiere nada nuevo.

---

## Cuándo NO usarlo (8:00 - 8:45)

> "Con dos ramas, un `if` está bien y es más corto. Esto empieza a pagar en la tercera, o
> cuando son equipos distintos agregando ramas al mismo archivo. Un `chain` de un solo handler
> es un `if` con pasos extra."

---

## Notas de grabación

- El número **0 centavos** de la primera corrida es el gancho de todo el video. Que quede en
  pantalla el mayor tiempo posible.
- En Python los handlers reciben `(request, next_)` — con guion bajo, porque `next` es una
  función incorporada. Menciónalo, la gente lo va a teclear mal.
