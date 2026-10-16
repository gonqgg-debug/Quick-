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

El precio de la caja ya incluye ITBIS. `precioUnit`, `total` y `subtotalConItbis` son lo que pagó el cliente. No los multipliques por 1.18. `subtotal` es la base sin el impuesto; en el ejemplo, 50 cobrados son 42.37 de base y 7.63 de ITBIS. La venta del día se guarda con el impuesto incluido. El margen resta ese 18% antes de comparar con el costo.

No mandes `categ_id`, `pos.category`, `standard_price`, `total_cost`, `categoria` ni `costo`. La respuesta es `422`.

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

`alerta` es true si `|totalPagos − sumaOrdenes| > 0.01` o lo mismo contra la suma de pagos. La sesión igual se guarda. `ventaReal` no se pisa si ese día está fijado a mano (`overrideManual`).

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

Cuando se corrige `products.codigo_odoo`, un trigger re-matchea las líneas de ese código y recalcula solo las fechas afectadas.
