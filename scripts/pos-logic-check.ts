import assert from "node:assert/strict";
import {
  addProductToCart,
  cartAmountDue,
  findProductsByBarcode,
  manualDiscountWithinCap,
  priceCart,
  quickcoinsEarn,
  setLineDiscount,
  buildSale,
  cartTotal,
  cashChangeAmount,
  isPosSaleDraft,
  parsePosVentaInput,
  pendingQtyByProduct,
  buildOpenShift,
  buildShiftClose,
  isPosShiftRecord,
  parseAbrirTurnoInput,
  posQuickCashAmounts,
  productMatchesQuery,
  setCartQty,
  shiftCashExpected,
  shiftDifference,
  shiftDifferenceLabel,
  shiftTotals,
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
  codigoBarras: "7501234567890",
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
const turnoId = "44444444-4444-4444-8444-444444444444";
const sale = buildSale({
  clientId,
  createdAt: "2026-09-29T12:00:00.000Z",
  lines: [{ productoId: product.id, nombre: product.nombre, precioUnitario: 35, cantidad: 2 }],
  metodoPago: "efectivo",
  montoRecibido: 100,
  turnoClientId: turnoId,
  cajero: "Ana",
});
assert.ok(isPosSaleDraft(sale));
if (isPosSaleDraft(sale)) {
  assert.equal(sale.total, 70);
  assert.equal(sale.cambio, 30);
  assert.equal(sale.status, "pendiente_sync");
  assert.equal(sale.turnoClientId, turnoId);
  assert.equal(sale.cajero, "Ana");
}
assert.equal(isPosSaleDraft(buildSale({
  clientId,
  createdAt: "2026-09-29T12:00:00.000Z",
  lines: [{ productoId: product.id, nombre: product.nombre, precioUnitario: 35, cantidad: 1 }],
  metodoPago: "efectivo",
  montoRecibido: 50,
  turnoClientId: "no-turno",
  cajero: "Ana",
})), false);

const opened = buildOpenShift({
  clientId: turnoId,
  abiertoEn: "2026-09-29T12:00:00.000Z",
  abiertoPor: "  Ana  ",
  fondoInicial: 1000,
});
assert.ok(isPosShiftRecord(opened));
if (isPosShiftRecord(opened)) {
  assert.equal(opened.abiertoPor, "Ana");
  assert.equal(opened.fondoInicial, 1000);
  assert.equal(opened.estado, "abierto");
  const totals = shiftTotals([
    { metodoPago: "efectivo", total: 70 },
    { metodoPago: "tarjeta", total: 40 },
    { metodoPago: "efectivo", total: 10.5 },
  ]);
  assert.equal(totals.efectivo, 80.5);
  assert.equal(totals.tarjeta, 40);
  assert.equal(totals.ventas, 3);
  assert.equal(shiftCashExpected(opened.fondoInicial, totals.efectivo), 1080.5);
  const closed = buildShiftClose({
    shift: opened,
    sales: [
      { metodoPago: "efectivo", total: 70 },
      { metodoPago: "tarjeta", total: 40 },
      { metodoPago: "efectivo", total: 10.5 },
    ],
    efectivoContado: 1000,
    notas: "  faltó sencillo  ",
    cerradoEn: "2026-09-29T20:00:00.000Z",
  });
  assert.ok(!("error" in closed));
  if (!("error" in closed)) {
    assert.equal(closed.esperado, 1080.5);
    assert.equal(closed.diferencia, -80.5);
    assert.equal(closed.shift.ventasAlCierre, 3);
    assert.equal(closed.shift.notas, "faltó sencillo");
    assert.equal(closed.shift.cierreSync, "pendiente_sync");
    assert.equal(shiftDifference(closed.esperado, closed.esperado), 0);
    assert.equal(shiftDifferenceLabel(0).text, "Cuadra");
    assert.equal(shiftDifferenceLabel(-80.5).tone, "short");
    assert.equal(shiftDifferenceLabel(20).tone, "over");
  }
}
assert.equal(isPosShiftRecord(buildOpenShift({
  clientId: turnoId,
  abiertoEn: "2026-09-29T12:00:00.000Z",
  abiertoPor: "   ",
  fondoInicial: 0,
})), false);

const abrir = parseAbrirTurnoInput({
  client_id: turnoId,
  abierto_por: "Luis",
  fondo_inicial: 500,
});
assert.equal(abrir.ok, true);

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

const discounted = setLineDiscount(
  [{ productoId: product.id, nombre: product.nombre, precioUnitario: 100, cantidad: 1 }],
  product.id,
  { tipo: "porcentaje", valor: 10 },
  { tipo: "ninguno" }
);
assert.ok(Array.isArray(discounted));
if (Array.isArray(discounted)) {
  assert.equal(cartAmountDue(discounted, { tipo: "ninguno" }), 90);
  assert.equal(manualDiscountWithinCap(discounted, { tipo: "porcentaje", valor: 20 }), false);
  const priced = priceCart(discounted, { tipo: "ninguno" }, 0);
  assert.ok(!("error" in priced));
}
assert.equal(findProductsByBarcode([product], "7501234567890").length, 1);
assert.equal(findProductsByBarcode([product], "cafe").length, 0);
assert.equal(quickcoinsEarn(10000), 10);
assert.equal(quickcoinsEarn(900), 0);

console.log("pos logic ok");
