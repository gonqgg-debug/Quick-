import { NextRequest, NextResponse } from "next/server";
import { IMPORT_MAX_BYTES, applyImportPreview, buildImportPreview, fetchImportProducts, type ImportPreview } from "@/lib/catalog-import";
import type { Actor } from "@/lib/operacion-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

/** Lo que el agente ve de cada lista; el total completo va en totales. */
const MUESTRA = 50;

const COLUMNAS = ["codigo", "nombre", "precio", "categoria", "marca", "codigo de barras"] as const;

function csvCelda(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Convierte productos: [{ codigo, nombre, precio, categoria, marca, codigoBarras }] al mismo CSV que lee el import. */
export function productosACsv(productos: unknown[]): string {
  const filas = productos.map((raw) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return [
      item.codigo ?? item.codigoOdoo,
      item.nombre,
      item.precio,
      item.categoria,
      item.marca,
      item.codigoBarras ?? item.barras,
    ]
      .map(csvCelda)
      .join(",");
  });
  return [COLUMNAS.join(","), ...filas].join("\n");
}

type Entrada = { buffer: Buffer; nombre: string; confirmar: boolean };

async function leerEntrada(request: NextRequest): Promise<Entrada> {
  const tipo = request.headers.get("content-type") ?? "";
  const confirmarQuery = request.nextUrl.searchParams.get("confirmar") === "true";
  if (tipo.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("archivo") ?? form.get("file");
    if (!file || typeof file === "string") {
      throw new Error("Manda el archivo en el campo archivo (.xlsx o .csv)");
    }
    if (file.size > IMPORT_MAX_BYTES) {
      throw new Error("El archivo pasa de 4 MB");
    }
    return {
      buffer: Buffer.from(await file.arrayBuffer()),
      nombre: file.name || "catalogo.xlsx",
      confirmar: confirmarQuery || form.get("confirmar") === "true",
    };
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("El cuerpo tiene que ser un JSON o multipart");
  }
  const confirmar = confirmarQuery || body.confirmar === true;
  const nombre = typeof body.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : "catalogo.csv";
  let buffer: Buffer | null = null;
  let archivo = nombre;
  if (Array.isArray(body.productos) && body.productos.length) {
    buffer = Buffer.from(productosACsv(body.productos), "utf8");
    archivo = "productos.csv";
  } else if (typeof body.csv === "string" && body.csv.trim()) {
    buffer = Buffer.from(body.csv, "utf8");
    archivo = nombre.toLowerCase().endsWith(".csv") ? nombre : `${nombre}.csv`;
  } else if (typeof body.base64 === "string" && body.base64.trim()) {
    buffer = Buffer.from(body.base64.replace(/^data:[^,]*,/, ""), "base64");
  }
  if (!buffer) {
    throw new Error("Manda productos: [{ codigo, nombre, precio, categoria }], csv, o base64 con nombre");
  }
  if (buffer.length > IMPORT_MAX_BYTES) {
    throw new Error("El archivo pasa de 4 MB");
  }
  return { buffer, nombre: archivo, confirmar };
}

function resumen(preview: ImportPreview) {
  return {
    archivo: preview.fileName,
    columnas: preview.columns,
    totales: {
      filas: preview.totals.rows,
      nuevos: preview.totals.created,
      actualizados: preview.totals.updated,
      sinCambios: preview.totals.unchanged,
      invalidos: preview.totals.invalid,
      noVienenEnElArchivo: preview.totals.missing,
    },
    nuevos: preview.created.slice(0, MUESTRA),
    actualizados: preview.updated.slice(0, MUESTRA).map((item) => ({
      codigo: item.codigo,
      nombre: item.nombre,
      cambios: item.changes.map((change) => ({ campo: change.field, antes: change.fromLabel, ahora: change.toLabel })),
    })),
    invalidos: preview.invalid.slice(0, MUESTRA).map((item) => ({ fila: item.row, codigo: item.codigo, razon: item.reason })),
  };
}

/** Los errores del lector son de validación; los de Supabase no son instancias de Error. */
export function catalogoError(error: unknown, fallback: string, logLabel: string): NextResponse {
  if (error instanceof Error && error.message) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(logLabel, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/**
 * Rodrigo importa productos al catálogo con el mismo lector que el admin: código Odoo, nombre, precio y categoría
 * son obligatorios. Sin confirmar solo muestra qué cambiaría. Nunca borra: lo que no viene en el archivo se queda igual.
 */
export async function handleImportarCatalogo(request: NextRequest, actor: Actor) {
  const entrada = await leerEntrada(request);
  const supabase = getSupabaseAdminClient();
  const preview = buildImportPreview(entrada.buffer, entrada.nombre, await fetchImportProducts(supabase));
  const vista = resumen(preview);
  if (!entrada.confirmar) {
    return NextResponse.json({ confirmado: false, ...vista });
  }
  if (!preview.created.length && !preview.updated.length) {
    return NextResponse.json({ confirmado: true, aplicados: { nuevos: 0, actualizados: 0 }, ...vista });
  }
  const aplicado = await applyImportPreview(supabase, preview);
  console.info("[agent] catalogo importado", { por: actor, archivo: preview.fileName, nuevos: aplicado.created, actualizados: aplicado.updated });
  return NextResponse.json({ confirmado: true, aplicados: { nuevos: aplicado.created, actualizados: aplicado.updated }, ...vista }, { status: 201 });
}
