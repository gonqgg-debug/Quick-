# Miles, analista comercial

Miles consulta el consumo y publica hallazgos. No hay un modelo de IA dentro de la plataforma. El dashboard y la API usan los mismos cálculos.

## Definiciones

- Venta válida: órdenes `paid`, `done` e `invoiced`. `draft` y `cancel` se guardan y no entran. Una devolución con total negativo resta. El descuento ya está dentro del total cobrado; no se resta otra vez.
- ITBIS: el precio y el costo lo traen. El margen es `(venta − unidades × costo) / (1 + tasa/100)`, con la tasa de la línea o, si no vino, la del producto.
- Tickets: esas órdenes. Ticket promedio: venta con ITBIS / tickets. Unidades por ticket: unidades / tickets.
- Fecha comercial: `America/Santo_Domingo`. `pos_ordenes.fecha` es `timestamptz`. La hora real se obtiene con una sola conversión `AT TIME ZONE 'America/Santo_Domingo'`. `hora_local` y `fecha_operativa` ya quedaron grabadas en esa zona al ingerir; no se convierten otra vez. El día de caja es el día en que se abrió la sesión: una venta después de medianoche sigue en ese día.
- Costo: manual si existe; si no, la última factura. No es el costo del día de la venta. Usarlo hacia atrás es una estimación. Sin costo, el margen es null, no cero. La cobertura es venta con ITBIS que tiene costo / venta con ITBIS del periodo. No se extrapola.
- Periodo anterior: la misma cantidad de días completos, terminando el día antes. El día en curso no entra en la comparación. En el resumen se pide con `comparacion=anterior`.
- Semana anterior: `comparacion=semana`, `comparacion=semana anterior` o `comparar=semana_anterior`. La ventana se corre un múltiplo de 7, el menor que no se solapa. El 15 de octubre se compara con el 8, no con el 14. La tarjeta del resumen compara la semana en curso, de lunes a la fecha de corte, con esos mismos días de la semana anterior. El modo resuelto vuelve en `filtros.comparacion`.
- Año anterior: `comparacion=anio`. Las mismas fechas. El 29 de febrero cae en el 28. Si ese año no tiene filas, el estado es `no_disponible` o `sin_base`. No se rellena con cero.
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

`GET /api/agent` con ese token devuelve solo las funciones de Miles, la lista `consultas`, los `limites` de los campos y `baseUrl`.

Las llamadas van a `https://www.quickminimarket.com`. `https://quickminimarket.com` responde 308 hacia www. Un POST o PATCH que siga ese redirect puede perder el body.

## Publicar un hallazgo

```http
POST /api/agent/miles/runs
Authorization: Bearer <token de Miles>

{ "idempotencyKey": "corrida-2026-10-16" }
```

Para leerla, `GET /api/agent/miles/runs/<id>`. Responde `id`, `estado`, `version`, `datosHasta`, `corte` y `error`.

Para cerrarla hace falta `version` y `estado`. En este cierre `estado` sí se acepta, y solo puede ser `completada` o `fallida`.

```http
PATCH /api/agent/miles/runs/<id>

{ "version": 1, "estado": "completada" }
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

`titulo` admite hasta 160 caracteres. Si se pasa, la respuesta es «titulo supera 160 caracteres». Un título vacío sigue siendo «titulo es obligatorio». El tope también está en `limites.titulo` del discovery.

`evidencia.consultas` es una lista con al menos un nombre. También vale un string, `{ "nombre": "..." }`, la ruta `/api/agent/analytics/summary?desde=...` o una nota que contenga el nombre, por ejemplo `GET analytics/products semanal 2025-09-08..2026-10-11`. Si el texto no trae ningún nombre, el error cita lo recibido y la lista. `GET /api/agent` la publica en `consultas`. Los nombres válidos son:

- `analytics/coverage`, `analytics/summary`, `analytics/products`, `analytics/hours`, `analytics/baskets`
- `consumo_margen_periodo`, `consumo_top_productos`, `consumo_productos_totales`, `consumo_venta_alcance`
- `consumo_mapa_horas`, `consumo_producto_horas`, `consumo_categorias`, `consumo_canasta`, `consumo_canasta_par`
- `consumo_calidad_conteos`, `consumo_horarios`, `consumo_sin_costo`, `consumo_sin_match`, `consumo_sin_movimiento`

Una ruta `/api/agent/analytics/summary?desde=...` cuenta como `analytics/summary`. Los filtros van en `evidencia.filtros`, no dentro del nombre.

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

## Publicar una propuesta

```http
POST /api/agent/miles/proposals
Authorization: Bearer <token de Miles>
```

```json
{
  "idempotencyKey": "promo-agua-pan-2026-10-11",
  "tienda": "quick",
  "nombre": "Agua con el pan",
  "objetivo": "Subir los tickets que llevan pan y no llevan agua",
  "comportamiento": "Que quien compra pan también lleve agua.",
  "tipo": "combo",
  "estado": "por_revisar",
  "periodo": { "desde": "2026-10-01", "hasta": "2026-10-07" },
  "corte": "2026-10-07",
  "productos": [
    {
      "productId": "11111111-1111-4111-8111-111111111111",
      "cantidad": 1,
      "funcion": "principal",
      "precioHabitual": 25,
      "precioPromo": 22,
      "precioObservadoEn": "2026-10-07",
      "presentacion": null
    }
  ],
  "mecanica": {
    "precioCombo": null,
    "descuento": null,
    "compraMinima": null,
    "canal": "caja",
    "dias": "todos",
    "horas": "todo el día",
    "duracion": "7 días",
    "exclusiones": "",
    "acumulacion": "no acumulable",
    "limites": "sin límite publicado",
    "caja": "marcar ambos productos"
  },
  "hallazgos": [],
  "metricas": { "ticketsConPanSinAgua": 40 },
  "evidencia": {
    "solidez": "baja",
    "fundamento": "Un periodo corto y sin prueba.",
    "consultas": ["consumo_canasta_par"]
  },
  "limitaciones": "No hay modelo de demanda.",
  "supuestos": {},
  "escenarios": [],
  "costos": null,
  "modelo": null,
  "probabilidad": null,
  "visual": null
}
```

`tipo` es `combo`, `acompanamiento`, `compra_minima`, `horario` o `salida_inventario`. `funcion` es `principal`, `complemento` o `beneficio`. Cada producto lleva `productId` o `codigoOdoo` del catálogo. `estado` solo puede ser `borrador` o `por_revisar`. La misma `idempotencyKey` devuelve la misma propuesta; otro contenido es 409.

`solidez` alta, media o baja no es un porcentaje. `probabilidad` se omite, o llega completa: `valor` entre 0 y 1, `objetivo`, `horizonte`, `modelo`, `version`, `datos`, `supuestos`, `validacion` fuera de muestra, `evaluadaEn` y `limitaciones`. Un intervalo necesita `inferior`, `superior` y `representa`. Sin ese paquete la pantalla dice que todavía no es estimable.

Si `escenarios` trae `ingreso`, `costo`, `margen` y `tasa`, la API anota `aritmetica` en `coincide` o `difiere`. Eso no valida el modelo. El simulador de la plataforma usa la fórmula `combo-v1` con el costo vigente y la tasa de cada producto. Un precio único de combo con tasas distintas no calcula margen. En compra mínima hacen falta el costo del beneficio para quien ya superaba el umbral y el margen supuesto de la compra que lo cruza. Esos campos van en `supuestos` como `costoBeneficio` y `margenIncrementalUmbral`.

`GET /api/agent/miles/proposals` y `GET /api/agent/miles/proposals/<id>` devuelven productos, hallazgos, pruebas y evaluaciones. `PATCH` corrige texto, mecánica, evidencia, escenarios o el estado propio si `version` coincide. No acepta HTML, `decision`, descarte ni `lista_para_probar`.

Las solicitudes de propuestas y de ampliación salen en `GET /api/agent/miles/investigations`. El alcance trae `solicitud` `propuestas` o `ampliacion`, y `propuestaId` cuando aplica. Tomarlas no genera una propuesta.

## Permisos

| Acción | Miles | Admin |
| --- | --- | --- |
| Leer cobertura, resumen, productos, horas y canasta | sí | por el dashboard |
| Abrir y cerrar sus ejecuciones | sí | no |
| Publicar y corregir texto de sus hallazgos | sí | no publica como Miles |
| Publicar y corregir sus propuestas, escenarios y supuestos | sí, sin aprobar ni descartar | no publica como Miles |
| Descartar, archivar, pedir ampliación, marcar lista para probar | no | sí, sin encender la caja |
| Guardar una variante y crear una prueba con snapshot | no | sí |
| Crear y cambiar estado de pruebas | no | sí, sin tocar precios ni pedidos |
| Tomar investigaciones y evaluar pruebas | sí | no evalúa como Miles |
| Escribir ventas, costos, inventario, precios o permisos | no | según su rol de admin |
| Usar funciones de Rodrigo, Phillip u otros | no | no |

## Migración

`supabase/migrations/20261016200000_miles_consumo.sql` crea las tablas de Miles. `20261016220000_miles_visual.sql` agrega `visual`, `resolucion` y `recomendacion_estado`. `20261016230000_miles_promos.sql` crea propuestas, productos, hallazgos vinculados y variantes, y agrega `propuesta_id`, `variante_id` y `snapshot` a las pruebas. En producción quedó registrada como `20261016230000`. No enciende promociones.

Una propuesta guardada sigue siendo válida si no trae probabilidad ni visual. El estado de la propuesta no es el estado de la prueba. El snapshot de una prueba no se recalcula cuando cambian el catálogo o el simulador.
