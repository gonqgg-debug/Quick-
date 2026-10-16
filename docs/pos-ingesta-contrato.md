# Contrato de ingesta POS

La caja empuja sesiones cerradas. La plataforma no abre conexión con Odoo.

Auth: `Authorization: Bearer <AGENT_TOKEN_RODRIGO>` en el POST. Los GET aceptan cualquier token de agente, incluido `AGENT_API_TOKEN`.

Zona: `start_at` y `date_order` vienen en UTC. La plataforma calcula `fecha_operativa` como la fecha de **apertura** de la sesión en `America/Santo_Domingo`. Una orden de las 00:30 queda en el día en que se abrió la caja, hora local 0. No mandes `fecha_operativa`: si viene, se ignora.

## POST `/api/agent/pos/sesiones`

Una sesión por request, y como máximo 1.500 líneas. Si no, `413`.

```json
{
  "tienda": "quick",
  "sesiones": [
    {
      "sesion": {
        "odooId": 839,
        "nombre": "POS/00839",
        "odooConfigId": 1,
        "estado": "closed",
        "startAt": "2026-10-15T14:00:00Z",
        "stopAt": "2026-10-16T04:10:00Z",
        "totalPagos": 15310,
        "efectivoInicial": 2000,
        "efectivoFinal": 8400,
        "odooWriteDate": "2026-10-16T04:12:00Z"
      },
      "ordenes": [
        {
          "odooId": 1001,
          "nombre": "Pedido 1001",
          "posReference": "Pedido 00001-001-0001",
          "fecha": "2026-10-16T04:30:00Z",
          "total": 250,
          "impuesto": 38.14,
          "pagado": 300,
          "cambio": 50,
          "estado": "done",
          "ncf": null,
          "clienteOdooId": null,
          "empleadoOdooId": 7,
          "lineas": [
            {
              "odooId": 5001,
              "odooProductId": 88,
              "odooTmplId": 88,
              "codigoOdoo": "__export__.product_template_88",
              "nombreOdoo": "Agua 16oz",
              "cantidad": 2,
              "precioUnit": 25,
              "descuento": 0,
              "subtotal": 42.37,
              "subtotalConItbis": 50,
              "odooRefundedLineId": null
            }
          ],
          "pagos": [
            {
              "odooId": 9001,
              "metodoOdooId": 1,
              "metodo": "Efectivo",
              "monto": 300,
              "fecha": "2026-10-16T04:30:00Z",
              "esCambio": false,
              "tipoTarjeta": null
            }
          ]
        }
      ]
    }
  ]
}
```

También se aceptan los nombres de Odoo (`odoo_id`, `start_at`, `amount_total`, `qty`, `price_subtotal_incl`, `payment_method_id`, `is_change`, `full_product_name`).

El mismo cuerpo se acepta con un objeto `sesion` y `ordenes` al nivel de arriba, sin el arreglo `sesiones`. Si vienen las dos formas, la respuesta es `422` y `campo` es `sesiones`.

```json
{
  "tienda": "quick",
  "modo": "completo",
  "sesion": { "odooId": 839, "estado": "closed", "startAt": "2026-10-15T14:00:00Z", "totalPagos": 15310 },
  "ordenes": []
}
```

`modo` es `completo` (el default), `parcial` o `final`. `parcial` y `final` exigen `loteId`, el mismo en todas las partes de esa sesión. `parcial` agrega o actualiza las órdenes que vienen y no borra las que faltan ni recalcula resúmenes ni `ventas_diarias`. `final` borra las órdenes de la sesión cuyo `lote_id` no es ese lote (lo que no llegó en ninguna parte), guarda lo que trae este request y recalcula. `completo` sigue reemplazando lo que no venga en ese único request. El tope de 1.500 líneas es por request. No hay tope por sesión.

El precio de la caja ya incluye ITBIS. `precioUnit`, `total` y `subtotalConItbis` son lo que pagó el cliente. No los multipliques por 1.18. `subtotal` es la base sin el impuesto; en el ejemplo, 50 cobrados son 42.37 de base y 7.63 de ITBIS. La venta del día se guarda con el impuesto incluido.

La tasa no es fija. Cada línea puede traer `tasaItbis` (0, 16 o 18; `0.16` se lee como 16). `tax_ids` son ids de `account.tax`, no el porcentaje: un `18` ahí es el id del registro, no 18%. Esos ids se resuelven con `impuestos` en el mismo request, una lista `{ "id": 5, "tasa": 16 }`. Si la línea no trae `tasaItbis` y algún id está en ese mapa, se usa esa tasa. Si no, se usa `products.tasa_itbis`. El default del producto es 18. Un id sin mapa no rechaza la sesión. `tasaItbis` explícito, incluido el 0, gana sobre el mapa. El margen es `venta_con_itbis / (1 + tasa/100) − unidades × costo_sin_itbis`. `products.costo_manual` y `factura_lineas.costo_unitario` se guardan **sin ITBIS**.

`GET /api/agent/catalogo` devuelve esa tasa en `tasaItbis` y en `tasa_itbis`. El precio del catálogo ya la incluye.

Solo entran en la venta y en los resúmenes las órdenes `paid`, `done` e `invoiced`. `draft` y `cancel` se guardan y se excluyen. Un total negativo (devolución) resta.

No mandes `categ_id`, `pos.category`, `standard_price`, `total_cost`, `categoria` ni `costo`. La respuesta es `422` y `campo` dice cuál sobró. Si la sesión viene mal formada, la respuesta es `422` con `campo` (`sesion.startAt`, `loteId`, `lineas.tasaItbis`, …), no un 500.

`codigoOdoo` es el external id `__export__` de `product.template` (product.product → product.template → `ir.model.data`). La plataforma cruza con `products.codigo_odoo`. Si no hay producto, la línea se guarda como `sin_match`. No se crea el producto.

Sesiones que no estén `closed` no se escriben. Vuelven en `ignoradas`.

Reenviar la misma sesión reemplaza órdenes, líneas y pagos que ya no vengan. No duplica.

### Respuesta 200

```json
{
  "tienda": "quick",
  "ignoradas": [],
  "sesion": { "odooId": 839, "fechaOperativa": "2026-10-15" },
  "insertados": { "sesiones": 1, "ordenes": 1, "lineas": 1, "pagos": 1 },
  "actualizados": { "sesiones": 0, "ordenes": 0, "lineas": 0, "pagos": 0 },
  "borrados": { "ordenes": 0, "lineas": 0, "pagos": 0 },
  "sinMatch": 0,
  "totalSesion": 15310,
  "sumaOrdenes": 15310,
  "sumaPagos": 15310,
  "alerta": false,
  "ventaDia": {
    "fecha": "2026-10-15",
    "ventaReal": 85075,
    "ventaPos": 85075,
    "origen": "pos",
    "overrideManual": false
  }
}
```

`alerta` es true si `|totalPagos − sumaOrdenes| > 0.01` o lo mismo contra la suma de pagos, contando solo órdenes `paid`, `done` e `invoiced`. En `modo: parcial` siempre es false. La sesión igual se guarda.

`ventaReal` no se pisa si ese día está fijado a mano (`overrideManual`). La migración marca `override_manual` en todas las filas de `ventas_diarias` que ya existían. El POST igual escribe `ventaPos`. Si el monto fijado y la caja difieren en más de RD$500, `alerta_pos` queda en true y el admin lo muestra.

## GET `/api/agent/pos/sesiones?desde=YYYY-MM-DD&cursor=&limit=`

Para el backfill. `ultimoOdooId` es la sesión más alta ya cargada, sin filtrar por fecha. `sesiones` respeta `desde` y el cursor (`odooId` de la última fila vista). `limit` máximo 500.

El script de la caja recorre de la sesión 1 a la 840, salta las que ya están, espera entre lotes y retoma por `ultimoOdooId` si se corta.

## GET de lectura

Todos aceptan `limit` (default 50, máximo 500) y `cursor`. La respuesta trae `rows` y `nextCursor`.

- `GET /api/agent/pos/sin-match?desde=&hasta=`
- `GET /api/agent/consumo/top?desde=&hasta=&orden=venta|unidades|margen|variacion&categoria=&q=`
- `GET /api/agent/consumo/sin-movimiento?dias=14|30|60`
- `GET /api/agent/consumo/sin-costo?dias=30`
- `GET /api/agent/consumo/horarios?desde=&hasta=&categoria=&metrica=venta|ordenes|unidades`
- `GET /api/agent/consumo/canasta?semana=YYYY-MM-DD` (el lunes de esa semana)
- `GET /api/agent/consumo/ticket?desde=&hasta=`
- `GET /api/agent/consumo/tendencias?hasta=`

Cuando se corrige `products.codigo_odoo` o `products.tasa_itbis`, el trigger solo encola el código en `pos_rematch_cola`. La importación del catálogo no recalcula en ese momento. El cambio de tasa recalcula `venta_neta` y el margen de las líneas que no trajeron tasa propia. La tasa guardada en la línea sigue ganando.

## POST `/api/agent/pos/rematch`

Auth de Rodrigo. Cuerpo opcional `{ "limite": 500 }` (máximo 500). Cada llamada recalcula como máximo 31 fechas. Las líneas de una fecha que no entró siguen pendientes y el cursor no las salta. Responde `{ "procesadas": 120, "pendientes": 40, "fechas": 31 }`. Hay que llamarlo hasta que `pendientes` sea 0.

## GET `/api/agent/pos/partes`

Sesiones que llegaron con `modo: parcial` y todavía no tienen el `final`. La respuesta trae `partes`: `odooId`, `nombre`, `fechaOperativa`, `loteId` e `ingestedAt`. El tablero de consumo muestra el mismo aviso.

## Pruebas

```bash
npx tsx scripts/check-pos-consumo.ts
npx tsx scripts/check-pos-consumo-db.ts
```

La primera no toca la base: parser, margen con tasas 0, 16 y 18, estados, partes y el día de 85.075. La segunda crea la base `quick_pos_test` en el Postgres local, aplica `supabase/migrations/20261016120000_pos_ingesta.sql` y llama `ingestar_pos_sesion`. Si existen `PGHOST`, `PGPORT`, `PGUSER` y `PGPASSWORD`, usa ese servidor en vez del Postgres local. La GitHub Action `POS consumo` corre las dos en cada push y en cada pull request.
