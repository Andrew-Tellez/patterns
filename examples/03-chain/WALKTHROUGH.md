# Chain of Responsibility — paso a paso

**Patrón:** Chain of Responsibility — `chain()` en TypeScript y en Python

---

## El síntoma

> Un endpoint de webhook, tres proveedores de pago, y cada uno manda el monto en un formato
> distinto. Mira este `if/else if`. Ahora mira lo que pasa cuando llega un cuarto proveedor
> que nadie contempló: el monto se normaliza a **cero pesos** y el webhook responde 200. Sin
> error. Sin log.

Corre `before.ts`. Sale: **`paypal → 0 centavos`**.

---

## El problema

1. **La escalera crece hacia abajo.** Señala que cada proveedor nuevo es otro `else if` en la
   *misma* función. Tres personas tocando el mismo archivo, tres conflictos de merge.
2. **El `else` final es una mentira.** `return { cents: 0 }` es lo que hace que un pago
   desconocido se registre como gratis. Nadie lo escribió con mala intención: lo escribió para
   que TypeScript dejara de quejarse.
3. **No se puede probar por partes.** Para testear la rama de SPEI tienes que construir un
   payload completo y pasar por las dos ramas anteriores.

---

## La solución

### 1. el import

```ts
import { chain } from 'gof-patterns';
```

### 2. un handler por proveedor

Convierte el primer `if` en un handler, en pantalla:

```ts
const fromStripe = (e: Incoming, next: () => Amount): Amount =>
  e.source === 'stripe' ? { cents: e.data!.total! } : next();
```

> La firma es lo único que hay que entender: recibe la petición y recibe `next`. O contesta,
> o llama a `next` y le pasa el turno al siguiente.

Convierte el segundo. Ya se ve el patrón; ve más rápido.

### 3. el arreglo, y el fallback

```ts
const normalize = chain<Incoming, Amount>([fromStripe, fromSpei], (e) => {
  throw new Error(`unknown source: ${e.source}`);
});
```

Detente en el fallback:

> Aquí está la parte importante. El `else` que devolvía cero ahora es un fallback
> **explícito**, y decidí que truene. Un pago que no sé interpretar es un error, no cero pesos.
> Antes esa decisión estaba escondida en un `return` al final de una escalera. Ahora es un
> argumento, y se ve.

### 4. agrega el cuarto proveedor

Esto es el cierre del argumento. Teclea un handler nuevo y agrégalo al arreglo:

```ts
const fromPaypal = (e: Incoming, next: () => Amount): Amount =>
  e.source === 'paypal' ? { cents: Math.round(e.gross! * 100) } : next();
```

> Una función nueva y una entrada en el arreglo. No abrí la función que ya funcionaba. Eso es
> lo que compra el patrón.

---

## El bonus que sí usarás

> Y funciona igual con async, porque `Res` puede ser una promesa. Mismo helper, sin una
> versión 'async' aparte.

Muestra el bloque async del archivo. Es el caso que de verdad vas a tener en producción
—consultar el proveedor, pegarle a la base— y no requiere nada nuevo.

---

## Cuándo NO usarlo

> Con dos ramas, un `if` está bien y es más corto. Esto empieza a pagar en la tercera, o
> cuando son equipos distintos agregando ramas al mismo archivo. Un `chain` de un solo handler
> es un `if` con pasos extra.
