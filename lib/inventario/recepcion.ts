import { findOrCreateProveedor } from "@/lib/contabilidad/compras";
import { dueDateFromCredit } from "@/lib/contabilidad/compras-shared";
import { parseNcf, parseRnc } from "@/lib/contabilidad/compra-fiscal";
import { getFactura } from "@/lib/contabilidad/facturas";
import { isDayKey } from "@/lib/local-day";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { estadoInventario, evaluarLineaRecepcion } from "@/lib/inventario/costos";
import { escribirMovimiento, lineasYaRecibidas, publicarInventario } from "@/lib/inventario/movimientos";
import type { InventarioOrigen, RecepcionResultado } from "@/lib/inventario/shared";

async function enlazarCompra(input: {
  facturaId: string;
  compraIdActual: string | null;
  proveedor: string | null;
  total: number | null;
  fecha: string | null;
  fechaVencimiento: string | null;
  rnc: string | null;
  ncf: string | null;
}): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const rnc = parseRnc(input.rnc ?? "");
  const ncf = parseNcf(input.ncf ?? "");
  if (!rnc.ok || !ncf.ok) {
    return input.compraIdActual;
  }

  if (input.compraIdActual) {
    await supabase.from("compras").update({ factura_id: input.facturaId }).eq("id", input.compraIdActual).is("factura_id", null);
    return input.compraIdActual;
  }

  const { data: existente, error: existenteError } = await supabase
    .from("compras")
    .select("id, factura_id")
    .eq("rnc", rnc.rnc)
    .eq("ncf", ncf.ncf)
    .maybeSingle();
  if (existenteError) {
    throw existenteError;
  }
  if (existente?.id) {
    if (!existente.factura_id) {
      await supabase.from("compras").update({ factura_id: input.facturaId }).eq("id", existente.id);
    }
    return String(existente.id);
  }

  const fecha = input.fecha && isDayKey(input.fecha) ? input.fecha : null;
  if (!input.proveedor?.trim() || input.total == null || !(input.total > 0) || !fecha) {
    return null;
  }
  const proveedor = await findOrCreateProveedor(input.proveedor.trim());
  const due =
    input.fechaVencimiento && isDayKey(input.fechaVencimiento)
      ? input.fechaVencimiento
      : dueDateFromCredit(fecha, proveedor);
  const { data, error } = await supabase
    .from("compras")
    .insert({
      proveedor_id: proveedor.id,
      monto: input.total,
      fecha,
      due_date: due,
      pagado: false,
      rnc: rnc.rnc,
      ncf: ncf.ncf,
      factura_id: input.facturaId,
    })
    .select("id")
    .single();
  if (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      const { data: otra } = await supabase.from("compras").select("id").eq("rnc", rnc.rnc).eq("ncf", ncf.ncf).maybeSingle();
      return otra?.id ? String(otra.id) : null;
    }
    throw error;
  }
  return data?.id ? String(data.id) : null;
}

export async function aplicarFacturaAInventario(idOrClave: string, origen: InventarioOrigen): Promise<RecepcionResultado> {
  const factura = await getFactura(idOrClave);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  const ya = await lineasYaRecibidas(factura.id);
  const aplicadas: RecepcionResultado["aplicadas"] = [];
  const omitidas: RecepcionResultado["omitidas"] = [];
  let yaAplicadas = 0;
  const tienda = factura.tienda;

  for (const linea of factura.lineas) {
    if (ya.has(linea.id)) {
      yaAplicadas += 1;
      continue;
    }
    const evaluada = evaluarLineaRecepcion({
      productoId: linea.productoId,
      unidadesTotales: linea.unidadesTotales,
      cantidadComprada: linea.cantidadComprada,
      presentacion: linea.presentacion,
      costoUnitario: linea.costoUnitario,
      costoPorPresentacion: linea.costoPorPresentacion,
    });
    if (!evaluada.ok) {
      omitidas.push({ numeroLinea: linea.numeroLinea, motivo: evaluada.motivo });
      continue;
    }
    const escrito = await escribirMovimiento({
      productoId: linea.productoId as string,
      tienda: tienda ?? "quick",
      tipo: "recepcion",
      cantidad: evaluada.unidades,
      costoUnitario: evaluada.costoUnitario,
      facturaId: factura.id,
      facturaLineaId: linea.id,
      origen,
      nota: factura.ncf || factura.numeroFactura,
    });
    if (escrito.yaExistia) {
      yaAplicadas += 1;
      continue;
    }
    aplicadas.push({
      numeroLinea: linea.numeroLinea,
      productoId: linea.productoId as string,
      unidades: evaluada.unidades,
      costoUnitario: evaluada.costoUnitario,
    });
  }

  let compraId = factura.compraId;
  try {
    compraId = await enlazarCompra({
      facturaId: factura.id,
      compraIdActual: factura.compraId,
      proveedor: factura.proveedor,
      total: factura.total,
      fecha: factura.fechaEmision,
      fechaVencimiento: factura.fechaVencimiento,
      rnc: factura.rnc,
      ncf: factura.ncf,
    });
  } catch (error) {
    console.error("[inventario] no se pudo enlazar la compra", error);
  }

  const estado = estadoInventario(yaAplicadas + aplicadas.length, omitidas.length);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("facturas")
    .update({
      compra_id: compraId,
      inventario_estado: estado,
      inventario_aplicado_en: estado === "pendiente" ? factura.inventarioAplicadoEn : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", factura.id);
  if (error) {
    throw error;
  }

  if (aplicadas.length) {
    await publicarInventario("inventario.recibido", {
      facturaId: factura.id,
      tienda: tienda || "quick",
      compraId,
      aplicadas,
      omitidas,
    });
  }

  return { estado, compraId, aplicadas, omitidas, yaAplicadas };
}
