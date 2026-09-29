import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { costoPromedioSiguiente, estadoInventario, evaluarLineaRecepcion } from "./costos.ts";

describe("costo promedio", () => {
  it("pondera una recepción sobre stock positivo", () => {
    assert.equal(costoPromedioSiguiente(10, 20, 5, 26), 22);
  });

  it("toma el costo nuevo cuando el stock está en cero o negativo", () => {
    assert.equal(costoPromedioSiguiente(0, 20, 4, 11), 11);
    assert.equal(costoPromedioSiguiente(-3, 20, 4, 11), 11);
  });
});

describe("líneas de recepción", () => {
  it("usa unidades totales y el costo unitario", () => {
    const result = evaluarLineaRecepcion({
      productoId: "p1",
      unidadesTotales: 24,
      cantidadComprada: 2,
      presentacion: "caja",
      costoUnitario: 18.5,
      costoPorPresentacion: 200,
    });
    assert.deepEqual(result, { ok: true, unidades: 24, costoUnitario: 18.5 });
  });

  it("no mueve una caja si no vienen las unidades", () => {
    const result = evaluarLineaRecepcion({
      productoId: "p1",
      unidadesTotales: null,
      cantidadComprada: 2,
      presentacion: "caja",
      costoUnitario: null,
      costoPorPresentacion: 200,
    });
    assert.deepEqual(result, { ok: false, motivo: "sin unidades por presentacion" });
  });

  it("acepta una unidad con costo por presentación", () => {
    const result = evaluarLineaRecepcion({
      productoId: "p1",
      unidadesTotales: null,
      cantidadComprada: 3,
      presentacion: "unidad",
      costoUnitario: null,
      costoPorPresentacion: 15,
    });
    assert.deepEqual(result, { ok: true, unidades: 3, costoUnitario: 15 });
  });

  it("omite la línea sin producto", () => {
    const result = evaluarLineaRecepcion({
      productoId: null,
      unidadesTotales: 1,
      cantidadComprada: 1,
      presentacion: "unidad",
      costoUnitario: 10,
      costoPorPresentacion: 10,
    });
    assert.equal(result.ok, false);
  });
});

describe("estado de inventario", () => {
  it("queda pendiente, parcial o aplicada", () => {
    assert.equal(estadoInventario(0, 2), "pendiente");
    assert.equal(estadoInventario(1, 1), "parcial");
    assert.equal(estadoInventario(2, 0), "aplicada");
  });
});
