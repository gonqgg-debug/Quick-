# Miles, analista comercial

Miles consulta el consumo y publica hallazgos. No hay un modelo de IA dentro de la plataforma. El dashboard y la API usan los mismos cálculos.

## Definiciones

- Venta válida: órdenes `paid`, `done` e `invoiced`. `draft` y `cancel` se guardan y no entran. Una devolución con total negativo resta. El descuento ya está dentro del total cobrado; no se resta otra vez.
- ITBIS: el precio y el costo lo traen. El margen es `(venta − unidades × costo) / (1 + tasa/100)`, con la tasa de la línea o, si no vino, la del producto.
- Tickets: esas órdenes. Ticket promedio: venta con ITBIS / tickets. Unidades por ticket: unidades / tickets.
- Fecha comercial: `America/Santo_Domingo`. `pos_ordenes.fecha` es `timestamptz`. La hora real se obtiene con una sola conversión `AT TIME ZONE 'America/Santo_Domingo'`. `hora_local` y `fecha_operativa` ya quedaron grabadas en esa zona al ingerir; no se convierten otra vez. El día de caja es el día en que se abrió la sesión: una venta después de medianoche sigue en ese día.
- Costo: manual si existe; si no, la última factura. No es el costo del día de la venta. Usarlo hacia atrás es una estimación. Sin costo, el margen es null, no cero. La cobertura es venta con ITBIS que tiene costo / venta con ITBIS del periodo. No se extrapola.
- Periodo anterior: la misma cantidad de días completos, terminando el día antes. El día en curso no entra en la comparación.
- Mismos días: la ventana se corre un múltiplo de 7, el menor que no se solapa.
- Año anterior: las mismas fechas. El 29 de febrero cae en el 28.
- Un día sin fila de resumen no es una venta en cero. Si al comparado le falta un día, la comparación dice “Comparación no disponible”. Si la base es cero, se muestran los importes y “Sin base anterior”, sin un porcentaje.
- Participación: venta del producto con ITBIS / venta con ITBIS de todo el periodo. El porcentaje de la página era la suma de esa página, no del periodo: 85,700 sobre 1,123,656 es 7.6%, no 14.2%.
- `ventas_diarias` es el libro de finanzas. Consumo no lo suma encima de las órdenes.
- Canasta de dos productos: un ticket lo contiene si la suma de cantidades, sin líneas de devolución, es mayor que cero. Repetido en el ticket cuenta una vez. Menos de 50 tickets elegibles o menos de 20 con ambos es muestra pequeña.
- Horas: el promedio divide entre las ocurrencias de una sesión cerrada en esa hora, incluidas las de cero ventas. No hay calendario de “cerrado”. Una hora sin ventas no se marca como tienda cerrada. Una sesión sin hora de cierre es cobertura incompleta.

## Token

Cada entorno emite el suyo. No se copia el de desarrollo a producción y no se commitea.

1. Entra al admin y abre Consumo → Miles.
2. “Emitir token” o “Rotar token”.
3. Cópialo en ese momento. La pantalla no lo vuelve a mostrar. En la base solo queda el hash SHA-256.
4. Rotar revoca el anterior. Revocar también se puede con `POST /api/admin/miles/token` y `{ "revocar": true, "id": "..." }` desde una sesión de admin.
5. Miles se identifica solo por `Authorization: Bearer <token>`. Un `agent_id` en el cuerpo se rechaza.
6. En Vercel el valor va en `AGENT_TOKEN_MILES`, el token solo, sin el prefijo `Bearer`. El hash de `agent_credenciales` sigue valiendo si la variable no está.

`GET /api/agent` con ese token devuelve solo las funciones de Miles.

## Publicar un hallazgo

```http
POST /api/agent/miles/runs
Authorization: Bearer <token de Miles>

{ "idempotencyKey": "corrida-2026-10-16" }
```

```http
POST /api/agent/miles/findings
Authorization: Bearer <token de Miles>

{
  "idempotencyKey": "hallazgo-cerveza-2026-10-16",
  "patronClave": "cerveza-viernes-noche",
  "ejecucionId": "<id de la corrida>",
  "tipo": "oportunidad",
  "titulo": "La cerveza sube los viernes después de las 8",
  "resumen": "El ticket de cerveza queda por encima del resto de la semana.",
  "observacion": "En la semana del 10 al 15, la venta de cerveza después de las 20:00 fue mayor que el mismo tramo de la semana anterior.",
  "interpretacion": "Puede coincidir con el partido, no con un cambio de precio.",
  "recomendacion": "Probar un combo solo el viernes, sin cambiar el precio de lista.",
  "prioridad": "media",
  "prioridadJustificacion": "El cambio cabe en una semana y la cobertura de costo se mantuvo.",
  "periodo": { "desde": "2026-10-10", "hasta": "2026-10-15" },
  "comparacion": { "desde": "2026-10-03", "hasta": "2026-10-08", "modo": "semana" },
  "metricas": { "venta": 85700, "tickets": 120 },
  "muestras": { "tickets": 120 },
  "limitaciones": "El costo es el último disponible, no el del día de la venta.",
  "evidencia": {
    "consultas": ["consumo_margen_periodo", "consumo_mapa_horas"],
    "filtros": { "desde": "2026-10-10", "hasta": "2026-10-15" },
    "enlaces": [{ "pantalla": "horarios", "query": "preset=custom&desde=2026-10-10&hasta=2026-10-15&reloj=real" }]
  },
  "corte": "2026-10-15"
}
```

La misma clave con el mismo cuerpo devuelve el hallazgo. La misma clave con otro cuerpo responde 409. Otra semana del mismo `patronClave` crea un hallazgo nuevo y apunta al anterior.

`visual` es opcional. Si no viene, el hallazgo se muestra como texto. No se leen cifras del párrafo para dibujar un gráfico.

```json
"visual": {
  "tipo": "comparacion",
  "metrica": { "nombre": "venta", "valor": 85075, "unidad": "rd" },
  "comparacion": { "valor": 78000, "periodo": "8 al 14 oct 2026", "metodo": "mismos días" },
  "serie": [
    { "etiqueta": "8–14 oct", "valor": 78000 },
    { "etiqueta": "15–21 oct", "valor": 85075 }
  ],
  "fuente": "resumen_dia",
  "corte": "2026-10-21",
  "explorar": { "pantalla": "resumen", "query": "preset=custom&desde=2026-10-15&hasta=2026-10-21" }
}
```

`tipo` puede ser `tendencia`, `comparacion`, `horarios`, `concentracion`, `canasta` o `calidad`. `unidad` es `rd`, `numero` o `pct`. En `pct`, un valor entre 0 y 1 es una proporción; un valor mayor que 1 ya está en puntos porcentuales. `concentracion` y `calidad` usan `numerador` y `denominador`. `canasta` usa `muestra`, `numerador` y `categorias` con los dos productos. `tendencia` necesita al menos dos puntos en `serie`. `horarios` usa `categorias` con la etiqueta del día o la franja y su valor. `explorar.query` solo lleva filtros del dashboard, por ejemplo `preset=custom&desde=2026-10-15&hasta=2026-10-21`.

No se acepta HTML, JavaScript, URLs ni campos `html`, `script`, `style`, `component` o `srcdoc`. Si el nombre de `metrica` coincide con una cifra de `metricas` y el valor difiere, la pantalla avisa y no usa el gráfico como conclusión. Si no hay `visual`, se muestra el texto y el snapshot; no se extraen cifras del párrafo para fabricar una serie.

Un hallazgo viejo sin `visual` sigue siendo válido. Si el cuerpo no trae `visual`, la publicación no escribe esa columna. `resolucion` y `recomendacion_estado` los escribe una persona desde el panel, no Miles. `pendiente` o una limitación antigua que dice `RESUELTO` sin esos campos se muestra como «Requiere revisión». `resuelta` u `obsoleta` deja la recomendación escrita como anterior y saca el hallazgo de las alertas activas. El `estado` del registro no se reescribe buscando palabras.

## Consultar investigaciones

```http
GET /api/agent/miles/investigations?estado=pendiente
```

`pendiente` significa que nadie la ha tomado. Para tomarla:

```http
PATCH /api/agent/miles/investigations/<id>

{ "version": 1, "estado": "en_analisis" }
```

La respuesta va con `"estado": "completada"` y `respuesta`. Miles no puede cancelarla ni aprobar una prueba. Una evaluación (`POST /api/agent/miles/experiments/<id>/evaluations`) no cambia el estado de la prueba.

## Permisos

| Acción | Miles | Admin |
| --- | --- | --- |
| Leer cobertura, resumen, productos, horas y canasta | sí | por el dashboard |
| Abrir y cerrar sus ejecuciones | sí | no |
| Publicar y corregir texto de sus hallazgos | sí | no publica como Miles |
| Descartar, archivar, pedir ampliación | no | sí |
| Crear y cambiar estado de pruebas | no | sí, sin tocar precios ni pedidos |
| Tomar investigaciones y evaluar pruebas | sí | no evalúa como Miles |
| Escribir ventas, costos, inventario, precios o permisos | no | según su rol de admin |
| Usar funciones de Rodrigo, Phillip u otros | no | no |

## Migración

`supabase/migrations/20261016200000_miles_consumo.sql` crea las tablas de Miles. `20261016220000_miles_visual.sql` agrega `visual`, `resolucion` y `recomendacion_estado`. Hay que aplicarla en cada entorno antes de publicar hallazgos visuales o registrar una resolución. Este cambio no la aplica en producción.
