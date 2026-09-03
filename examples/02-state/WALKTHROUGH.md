# State — paso a paso

**Patrón:** State — `stateMachine()` en TypeScript, `StateMachine` en Python

---

## El síntoma

> Esta orden tiene tres booleanos: `isPaid`, `isShipped`, `isRefunded`. Y con esos tres
> booleanos puedo enviar una orden que nadie pagó, y puedo reembolsarla dos veces. No es un
> bug que metí a propósito: es lo que pasa siempre que modelas estados
> mutuamente excluyentes con banderas independientes.

Corre `before.ts`. La terminal dice: **`enviada sin pagar`** y **`reembolsada dos veces`**.

---

## El problema

Tres puntos:

1. **Tres booleanos son ocho combinaciones.** Dilo con números: `2³ = 8`. De esas ocho, solo
   cuatro son estados legales de una orden. Las otras cuatro son estados imposibles que tu tipo
   permite.
2. **La regla vive en cada llamador.** Señala `ship()` y `refund()`: cada una revisa las
   banderas que *ella* recuerda revisar. Ese `if` está copiado en cuatro servicios y en dos de
   ellos está incompleto.
3. **Falla en silencio.** Señala la salida: no hay excepción, no hay log. Solo un registro
   incorrecto que vas a encontrar la semana que viene, en un reporte de conciliación.

> Y fíjate en lo peor: para arreglarlo con booleanos tengo que agregar otro `if`. Y el
> siguiente estado va a agregar otros cuatro.

---

## La solución

### 1. el import

```ts
import { stateMachine } from 'gof-patterns';
```

### 2. la tabla de transiciones

Esto es el corazón del patrón:

```ts
const order = stateMachine<'draft' | 'paid' | 'shipped' | 'refunded',
                           'pay' | 'ship' | 'refund'>({
  initial: 'draft',
  states: {
    draft: { pay: 'paid' },
    paid: { ship: 'shipped', refund: 'refunded' },
    shipped: { refund: 'refunded' },
    refunded: {},
  },
});
```

> `draft` solo acepta `pay`. `paid` acepta `ship` o `refund`. `shipped` ya solo acepta
> `refund`. Y `refunded` no acepta nada: es un estado final, y eso se ve porque está vacío.

Detente ahí un momento:

> Esa tabla es la regla de negocio. Completa. En un lugar. La puede leer alguien que nunca
> vio el código, y te va a decir si está mal.

### 3. borra los ifs

Ve borrando las banderas y los `if` de `ship()` y `refund()`. Que se vea el código
**encogiendo**.

### 4. el audit trail gratis

```ts
order.onChange(({ from, to, event }) => audit.push(`${event}: ${from} -> ${to}`));
```

> Y como ya pasan todas las transiciones por un solo lugar, la bitácora sale de regalo. Cada
> cambio de estado, con el evento que lo causó, sin tocar ni un call site.

### 5. córrelo

El error: **`"ship" is not allowed in "draft"`**.

> Ahí está la diferencia. Antes: un registro incorrecto y silencio. Ahora: una excepción que
> te dice el evento y el estado, en el momento exacto en que alguien intentó lo imposible.

---

## Cuándo NO usarlo

Este bloque es el que hace que confíen en el canal. No te lo brinques.

> Y ahora lo contrario, porque esto se sobreusa muchísimo. Si tus booleanos son
> **independientes** —`isArchived`, `isStarred`— eso no son estados. Son cuatro combinaciones y
> las cuatro son legales. Una máquina de estados ahí es puro ceremonial.

> La prueba es una pregunta: ¿existe alguna combinación de tus banderas que sea imposible? Si
> la respuesta es no, déjalos como booleanos.

---

## Cierre

> El patrón State no es una clase por estado, como lo dibuja el libro. Es *la tabla*: qué
> eventos son legales en qué estado. Todo lo demás es plomería, y la plomería ya está escrita.

Muestra `git diff --stat`: el archivo quedó más corto que antes.
