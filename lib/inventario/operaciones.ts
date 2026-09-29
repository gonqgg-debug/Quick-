import { normalizarTienda, roundCantidad } from "@/lib/inventario/costos";
import {
  escribirMovimiento,
  publicarInventario,
  resolverProducto,
} from "@/lib/inventario/movimientos";
import type { InventarioOrigen } from "@/lib/inventario/shared";

export type LineaVentaInput = {
  productoId?: unknown;
  codigoOdoo?: unknown;
  codigoBarras?: unknown;
  cantidad?: unknown;
};

export type VentaResultado = {
  aplicadas: Array<{ productoId: string; cantidad: number; stockDespues: number }>;
  omitidas: Array<{ indice: number; motivo: string }>;
};

function cantidadPositiva(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return roundCantidad(number);
}

export async function registrarVentas(input: {
  tienda?: unknown;
  origen?: unknown;
  lineas?: unknown;
}): Promise<VentaResultado> {
  if (!Array.isArray(input.lineas) || input.lineas.length === 0) {
    throw new Error("Manda las líneas de la venta");
  }
  const tienda = normalizarTienda(input.tienda);
  const origen: InventarioOrigen = input.origen === "admin" || input.origen === "agente" ? input.origen : "pos";
  const aplicadas: VentaResultado["aplicadas"] = [];
  const omitidas: VentaResultado["omitidas"] = [];

  for (let indice = 0; indice < input.lineas.length; indice += 1) {
    const linea = input.lineas[indice];
    if (!linea || typeof linea !== "object") {
      omitidas.push({ indice, motivo: "linea invalida" });
      continue;
    }
    const row = linea as LineaVentaInput;
    const cantidad = cantidadPositiva(row.cantidad);
    if (cantidad == null) {
      omitidas.push({ indice, motivo: "sin cantidad" });
      continue;
    }
    const producto = await resolverProducto(row);
    if ("error" in producto) {
      omitidas.push({ indice, motivo: producto.error });
      continue;
    }
    const escrito = await escribirMovimiento({
      productoId: producto.id,
      tienda,
      tipo: "venta",
      cantidad,
      origen,
    });
    aplicadas.push({ productoId: producto.id, cantidad, stockDespues: escrito.stockDespues });
  }

  if (aplicadas.length) {
    await publicarInventario("inventario.vendido", { tienda, origen, aplicadas, omitidas });
  }
  return { aplicadas, omitidas };
}

export async function registrarAjuste(input: {
  tienda?: unknown;
  tipo?: unknown;
  productoId?: unknown;
  codigoOdoo?: unknown;
  codigoBarras?: unknown;
  cantidad?: unknown;
  nota?: unknown;
  origen?: InventarioOrigen;
}): Promise<{ productoId: string; cantidad: number; stockDespues: number }> {
  const tipo = input.tipo === "merma" || input.tipo === "ajuste" || input.tipo === "devolucion_proveedor" ? input.tipo : null;
  if (!tipo) {
    throw new Error("El tipo tiene que ser ajuste, merma o devolucion_proveedor");
  }
  const cantidad = typeof input.cantidad === "number" ? input.cantidad : typeof input.cantidad === "string" ? Number(input.cantidad) : NaN;
  if (!Number.isFinite(cantidad) || cantidad === 0) {
    throw new Error("La cantidad no puede ser cero");
  }
  if ((tipo === "merma" || tipo === "devolucion_proveedor") && cantidad < 0) {
    throw new Error("La merma se manda en positivo");
  }
  const producto = await resolverProducto(input);
  if ("error" in producto) {
    throw new Error(producto.error === "codigo repetido" ? "Hay más de un producto con ese código" : "No encontramos ese producto");
  }
  const nota = typeof input.nota === "string" ? input.nota : null;
  const escrito = await escribirMovimiento({
    productoId: producto.id,
    tienda: normalizarTienda(input.tienda),
    tipo,
    cantidad: roundCantidad(cantidad),
    origen: input.origen ?? "agente",
    nota,
  });
  await publicarInventario("inventario.ajustado", {
    tienda: normalizarTienda(input.tienda),
    tipo,
    productoId: producto.id,
    cantidad: roundCantidad(tipo === "ajuste" ? cantidad : -Math.abs(cantidad)),
    stockDespues: escrito.stockDespues,
    nota,
  });
  return { productoId: producto.id, cantidad: roundCantidad(cantidad), stockDespues: escrito.stockDespues };
}

export async function registrarConteo(input: {
  tienda?: unknown;
  productoId?: unknown;
  codigoOdoo?: unknown;
  codigoBarras?: unknown;
  cantidadContada?: unknown;
  nota?: unknown;
  origen?: InventarioOrigen;
}): Promise<{ productoId: string; stockDespues: number }> {
  const contado = typeof input.cantidadContada === "number" ? input.cantidadContada : typeof input.cantidadContada === "string" ? Number(input.cantidadContada) : NaN;
  if (!Number.isFinite(contado) || contado < 0) {
    throw new Error("La cantidad contada no puede ser negativa");
  }
  const producto = await resolverProducto(input);
  if ("error" in producto) {
    throw new Error(producto.error === "codigo repetido" ? "Hay más de un producto con ese código" : "No encontramos ese producto");
  }
  const escrito = await escribirMovimiento({
    productoId: producto.id,
    tienda: normalizarTienda(input.tienda),
    tipo: "conteo",
    cantidad: 0,
    contado,
    origen: input.origen ?? "admin",
    nota: typeof input.nota === "string" ? input.nota : "Conteo físico",
  });
  await publicarInventario("inventario.ajustado", {
    tienda: normalizarTienda(input.tienda),
    tipo: "conteo",
    productoId: producto.id,
    stockDespues: escrito.stockDespues,
  });
  return { productoId: producto.id, stockDespues: escrito.stockDespues };
}
