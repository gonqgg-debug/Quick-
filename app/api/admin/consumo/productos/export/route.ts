import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { codigoVisible, participacion } from "@/lib/consumo-metricas";
import { estadoCosto, etiquetaEstadoCosto, formatPctPlano, variacionProducto } from "@/lib/consumo-productos-ui";
import { exportarProductos } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

function celda(value: string | number | null | undefined): string {
  if (value == null) return "";
  const texto = String(value);
  if (/[",\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const { rows, resumen, estado, periodo } = await exportarProductos(request.nextUrl.searchParams);
    const comparar = estado === "ok" || estado === "sin_base";
    const encabezado = [
      "Producto",
      "SKU",
      "Código de barras",
      "Categoría",
      "Marca",
      "Unidades",
      "Ventas con ITBIS",
      "Participación",
      "Ventas netas",
      "Costo de ventas",
      "Utilidad bruta",
      "Margen bruto",
      "Estado del costo",
      ...(comparar ? ["Variación de ventas", "Venta anterior"] : []),
    ];
    const lineas = rows.map((row) => {
      const variacion = variacionProducto(estado, row.variacion, row.ventaAnterior);
      const valores = [
        row.nombre,
        codigoVisible(row.codigo) ?? "",
        row.codigoBarras ?? "",
        row.categoria,
        row.marca ?? "",
        row.unidades,
        row.venta,
        formatPctPlano(participacion(row.venta, resumen.venta)),
        row.ventaNeta ?? "",
        row.costo == null ? "Sin costo" : row.costoVentas ?? "",
        row.margen == null ? "" : row.margen,
        formatPctPlano(row.margenPct),
        etiquetaEstadoCosto(estadoCosto(row.costoOrigen, row.costo)),
        ...(comparar ? [variacion?.texto ?? "", row.ventaAnterior ?? ""] : []),
      ];
      return valores.map(celda).join(",");
    });
    const csv = `\uFEFF${encabezado.join(",")}\n${lineas.join("\n")}\n`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ventas-por-producto-${periodo.desde}-${periodo.hasta}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos exportar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
