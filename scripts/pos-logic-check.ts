import assert from "node:assert/strict";
import {
  addProductToCart,
  buildSale,
  cartTotal,
  cashChangeAmount,
  isPosSaleDraft,
  parsePosVentaInput,
  pendingQtyByProduct,
  posQuickCashAmounts,
  productMatchesQuery,
  setCartQty,
  stockBadge,
  withOptimisticStock,
  type PosStoredProduct,
} from "../lib/pos";

const product: PosStoredProduct = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Agua Cristal",
  marca: null,
  precio: 35,
  fotoUrl: null,
  categoria: "Bebidas",
  stockBase: 5,
};

const lines = addProductToCart([], { id: product.id, nombre: product.nombre, precio: product.precio });
assert.equal(lines[0]?.cantidad, 1);
assert.equal(addProductToCart(lines, { id: product.id, nombre: product.nombre, precio: 99 })[0]?.cantidad, 2);
assert.equal(addProductToCart(lines, { id: product.id, nombre: product.nombre, precio: 99 })[0]?.precioUnitario, 35);
assert.equal(setCartQty(lines, product.id, 0).length, 0);
assert.equal(cartTotal([{ precioUnitario: 10.1, cantidad: 2 }, { precioUnitario: 0.2, cantidad: 1 }]), 20.4);
assert.equal(cashChangeAmount(500, 180.5), 319.5);
assert.equal(productMatchesQuery({ nombre: "Café Bustelo" }, "cafe"), true);
assert.deepEqual(stockBadge(3), { label: "Quedan 3", tone: "low" });
assert.equal(stockBadge(6), null);
assert.equal(stockBadge(-2)?.tone, "negative");
assert.equal(stockBadge(null), null);

const quick = posQuickCashAmounts(180);
assert.equal(quick[0]?.label, "Exacto");
assert.equal(quick[0]?.amount, 180);
assert.ok(quick.some((item) => item.amount === 500));
assert.ok(quick.some((item) => item.amount === 2000));

const optimistic = withOptimisticStock(
  [product, { ...product, id: "22222222-2222-4222-8222-222222222222", stockBase: null, nombre: "Sin control" }],
  pendingQtyByProduct([
    {
      status: "pendiente_sync",
      items: [{ productoId: product.id, nombre: product.nombre, cantidad: 2, precioUnitario: 35 }],
    },
    {
      status: "sincronizada",
      items: [{ productoId: product.id, nombre: product.nombre, cantidad: 9, precioUnitario: 35 }],
    },
  ])
);
assert.equal(optimistic[0]?.stock, 3);
assert.equal(optimistic[1]?.stock, null);

const oversold = withOptimisticStock([product], new Map([[product.id, 8]]));
assert.equal(oversold[0]?.stock, -3);

const clientId = "33333333-3333-4333-8333-333333333333";
const sale = buildSale({
  clientId,
  createdAt: "2026-09-29T12:00:00.000Z",
  lines: [{ productoId: product.id, nombre: product.nombre, precioUnitario: 35, cantidad: 2 }],
  metodoPago: "efectivo",
  montoRecibido: 100,
});
assert.ok(isPosSaleDraft(sale));
if (isPosSaleDraft(sale)) {
  assert.equal(sale.total, 70);
  assert.equal(sale.cambio, 30);
  assert.equal(sale.status, "pendiente_sync");
}

const parsed = parsePosVentaInput({
  client_id: clientId,
  metodo_pago: "tarjeta",
  items: [{ producto_id: product.id, cantidad: 1, precio_unitario: 35, nombre: "Agua Cristal" }],
});
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.value.montoRecibido, null);
}

const short = parsePosVentaInput({
  client_id: clientId,
  metodo_pago: "efectivo",
  monto_recibido: 10,
  items: [{ producto_id: product.id, cantidad: 1, precio_unitario: 35 }],
});
assert.equal(short.ok, false);

console.log("pos logic ok");
