# Brief: expansión de datos Odoo → Plataforma Quick! (inteligencia de consumo)

Repo: `gonqgg-debug/Quick-` (Next.js 14 · Vercel · Supabase Postgres). Fecha: 16-oct-2026.

## Objetivo

Traer a la plataforma el detalle de ventas del POS de Odoo (sesiones, órdenes, líneas, pagos) para que la plataforma sea la fuente de verdad de la venta y podamos analizar el consumo: qué se vende, cuándo, qué va junto y cuánto gasta cada cliente. Odoo sigue siendo solo la caja. **No escribir nunca en Odoo.** **No depender de las existencias de Odoo** (no hay conteo; 1.550 de 1.953 productos tienen stock negativo).

**Principio:** los datos maestros de producto (nombre, categoría, costo, marca, empaque) los manda **nuestra plataforma**. De Odoo solo se traen **sesiones, órdenes, líneas (cantidad, precio, descuento, devoluciones) y pagos con su forma de pago**. De Odoo **no** se trae categoría (`categ_id`, `pos.category`) ni costo (`standard_price`, `total_cost`).

## Lo que hay en Odoo (medido el 16-oct-2026)

- Odoo 17 Enterprise, XML-RPC, db `quick`, 1 `pos.config` (CAJA-01, id 1).
- Historial desde **3-sep-2025** (sesión 1) / **5-sep-2025** (orden 1).
- `pos.session` 840. `pos.order` 80.385 (`done` + `invoiced` son venta). `pos.order.line` 188.890. `pos.payment` 96.653.
- `pos.payment.method`: Efectivo (1), Banco (2), Cuenta de cliente (3), TC-CARDNET (4).
- `product.template` / `product.product` 1.953. Solo se usan para el cruce. El external id `__export__` está en `product.template`.
- Volumen: ~6.000 órdenes y ~14.000 líneas/mes.

## Reglas de implementación

- `products.codigo_odoo` es la clave del catálogo. `sales_history_import` no se reutiliza.
- `orders` / `order_items` / `order_sessions` son pedidos de WhatsApp. No se mezclan.
- `tienda text not null default 'quick'` en las tablas nuevas.
- RLS + `service_role` only, como el resto de migraciones.
- La ingesta la empuja un agente externo. La plataforma no llama a Odoo y no guarda credenciales de Odoo.
- Costo y margen salen de `products.costo_manual` o de la última factura de compra en unidades. Los dos costos se guardan **sin ITBIS**. Sin costo, el margen es null, nunca 0. El precio de venta ya incluye ITBIS. La tasa es `tasaItbis` de la línea o, si no vino, el mapa `impuestos` de los ids de `account.tax` (`tax_ids` no es el porcentaje). Si tampoco hay mapa, se usa `products.tasa_itbis` (0, 16 o 18, default 18). La venta del día se muestra con el impuesto incluido. El margen es venta / (1 + tasa/100) − unidades × costo.
- Solo cuentan las órdenes `paid`, `done` e `invoiced`. `draft` y `cancel` se guardan y no entran en los resúmenes. Una devolución (monto negativo) resta.
- Una sesión grande puede llegar en partes con el mismo `loteId`: `parcial` agrega sin borrar ni recalcular; `final` borra lo que no vino en ninguna parte y recalcula. El tope de 1.500 líneas es por request.
- Cambiar `products.codigo_odoo` o `products.tasa_itbis` solo encola el re-cruce. `POST /api/agent/pos/rematch` lo procesa por lotes, con tope de fechas por llamada.
- Las filas de `ventas_diarias` que ya existían quedan con `override_manual`. El POS no las pisa. Si difieren en más de RD$500, queda `alerta_pos`.
- `ventas_diarias` se deriva de las sesiones. Un guardado manual queda como override.

El contrato del POST está en [pos-ingesta-contrato.md](pos-ingesta-contrato.md).

## Criterios de aceptación

- 15-oct-2026 = **RD$85.075** (POS/00839 15.310 + POS/00840 69.765). 14-oct = 15.880 + 47.915 = 63.795.
- Reenviar la misma sesión no duplica nada.
- Toda línea queda con `match_estado`. Sin match se guarda y no se crea ningún producto.
- Ningún campo de categoría o costo viene de Odoo.
- Producto sin costo → margen null. Aparece en `/consumo/sin-costo` ordenado por venta.
- `ventas_diarias` y `/metas` reflejan la sesión al terminar el POST, salvo override manual.
- Tableros y GET responden desde resúmenes, paginados, máximo 500 filas.
