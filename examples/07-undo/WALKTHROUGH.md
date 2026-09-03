# Command y Memento — paso a paso

**Patrones:** Command (`commandBus` / `CommandBus`) y Memento (`history` / `History`)
**Archivos:** `before.ts`, `after.ts`, `before.py`, `after.py`

Este es el único de los ejemplos que cubre **dos** patrones, porque resuelven el mismo pedido
—"queremos undo"— y elegir mal es lo que duele después.

---

## El síntoma

```bash
node examples/07-undo/before.ts
```

```
bytes copiados: 17748 ≈ 3 × 5912
```

Tres teclas. El documento completo copiado tres veces. Funciona perfecto en tu máquina con un
documento de prueba, y se cae cuando alguien pega uno real.

---

## El problema

El `before` guarda un snapshot del documento entero en cada edición. No está mal escrito: es
la primera solución que a cualquiera se le ocurre, y **es correcta**. El problema es su costo:

> memoria = tamaño del estado × profundidad del historial

Con 500 líneas y 50 niveles de undo son ~300 KB de copias para un documento de 6 KB. Y el
número que importa no lo controlas tú, lo controla el usuario.

---

## La pregunta que decide cuál usar

**¿Puedes describir la operación inversa?**

Si la respuesta es sí, quieres **Command**. Si es no, quieres **Memento**.

- "Agregar la línea X" se deshace con "quitar la línea X". → Command
- "Ordenar por monto" se deshace con... nada. "Desordenar" no es una operación. → Memento

Casi todo el mundo empieza con Memento porque es más obvio, y descubre el costo en producción.

---

## 1. Command, para lo invertible

```ts
const bus = commandBus();

const edit = (line: string) =>
  bus.run({
    do: () => doc.lines.push(line),
    undo: () => void doc.lines.pop(),
  });
```

Eso es todo. `bus.undo()`, `bus.redo()`, y **ningún byte del documento se copia** — lo que se
guarda son dos closures por edición, sin importar si el documento tiene 500 líneas o 500,000.

El `canUndo` / `canRedo` sirven para pintar los botones sin llevar tu propia cuenta.

---

## 2. Memento, para lo que no tiene inversa

```ts
const filters = history<Filters>(
  { sort: 'date', tags: [] },
  { limit: 50, snapshot: structuredClone },
);

filters.save({ sort: 'amount', tags: ['paid'] });
filters.undo();
```

El `limit` es el que evita que el historial crezca sin techo.

---

## El detalle que arruina un Memento hecho a mano

`snapshot` no es decoración. Sin él, el historial guarda **referencias**:

```ts
const careless = history(live);
careless.save(live);
live.tags.push('mutated');

careless.undo();   // { tags: ['a', 'mutated'] }  ← el pasado cambió
```

Deshacer te devuelve el objeto que acabas de mutar. El historial tiene cinco entradas y las
cinco son el mismo objeto. Ese bug se ve como "el undo no funciona a veces", y es de los más
difíciles de rastrear porque el código del undo está bien.

Con `snapshot: structuredClone` (o `copy.deepcopy` en Python) el pasado queda congelado. El
`after` lo demuestra con los dos casos lado a lado.

---

## Cuándo no usar ninguno

- **Si el estado ya es inmutable** —un `readonly` que reemplazas en vez de mutar— el `history`
  no necesita `snapshot`, y guardar la referencia es correcto y gratis.
- **Si necesitas que el undo sobreviva un refresh**, esto no es lo que buscas: `history` vive
  en memoria. Eso es persistencia, y es otro problema.
- **Si solo hay una acción deshacible**, un `lastAction` y un `if` son más cortos que
  cualquiera de los dos.
