import { NextRequest, NextResponse } from "next/server";
import { batchUpdateAdminCatalogProducts, updateAdminCatalogProduct } from "@/lib/admin-catalog-products";
import { IMPORT_MAX_BYTES, applyImportPreview, buildImportPreview, fetchImportProducts, type ImportPreview } from "@/lib/catalog-import";
import type { Actor } from "@/lib/operacion-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

/** Lo que el agente ve de cada lista; el total completo va en totales. */
const MUESTRA = 50;

const COLUMNAS = ["codigo", "nombre", "precio", "categoria", "marca", "codigo de barras", "costo"] as const;

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
      item.costo ?? item.cost,
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
    throw new Error("Manda productos: [{ codigo, nombre, precio, categoria, costo }], csv, o base64 con nombre");
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
 * son obligatorios. costo es opcional: si viene, se guarda como costo manual con fuente odoo y la fecha de esta importación. Si no viene, el costo manual no se toca. Sin confirmar solo muestra qué cambiaría. Nunca borra: lo que no viene en el archivo se queda igual.
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOTE_MAX = 500;

class NoEncontrado extends Error {}

/** Busca por id, código Odoo o código de barras. Un código que apunta a más de un producto no se adivina. */
async function resolverProductos(referencias: string[]): Promise<{ ids: Map<string, string>; faltan: string[] }> {
  const supabase = getSupabaseAdminClient();
  const ids = new Map<string, string>();
  const faltan: string[] = [];
  for (const referencia of referencias) {
    const valor = referencia.trim();
    if (!valor) {
      continue;
    }
    if (UUID.test(valor)) {
      const { data, error } = await supabase.from("products").select("id").eq("id", valor).maybeSingle();
      if (error) {
        throw error;
      }
      if (data?.id) {
        ids.set(valor, String(data.id));
      } else {
        faltan.push(valor);
      }
      continue;
    }
    const porOdoo = await supabase.from("products").select("id").eq("codigo_odoo", valor).limit(2);
    if (porOdoo.error) {
      throw porOdoo.error;
    }
    const filas = porOdoo.data?.length ? porOdoo.data : (await supabase.from("products").select("id").eq("codigo_barras", valor).limit(2)).data ?? [];
    if (filas.length > 1) {
      throw new Error(`Hay más de un producto con el código ${valor}. Manda el id`);
    }
    if (filas[0]?.id) {
      ids.set(valor, String(filas[0].id));
    } else {
      faltan.push(valor);
    }
  }
  return { ids, faltan };
}

async function cuerpoJson(request: NextRequest): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("El cuerpo tiene que ser un objeto JSON");
  }
  return body;
}

/** Rodrigo edita nombre, marca, categoría, precio o activo de un producto. Lo que no manda no cambia. */
export async function handleEditarProducto(referencia: string, request: NextRequest, actor: Actor) {
  const body = await cuerpoJson(request);
  const { ids } = await resolverProductos([decodeURIComponent(referencia)]);
  const id = ids.values().next().value;
  if (!id) {
    throw new NoEncontrado("No encontramos ese producto en el catálogo");
  }
  const producto = await updateAdminCatalogProduct({
    id,
    nombre: body.nombre,
    marca: body.marca,
    categoria: body.categoria,
    precio: body.precio,
    activo: body.activo,
    por: actor,
  });
  return NextResponse.json({ producto });
}

/** Activa o desactiva varios productos (y opcionalmente les cambia la categoría) por id, código Odoo o código de barras. */
export async function handleEstadoProductos(request: NextRequest, actor: Actor) {
  const body = await cuerpoJson(request);
  const lista = Array.isArray(body.productos) ? body.productos : Array.isArray(body.ids) ? body.ids : Array.isArray(body.codigos) ? body.codigos : null;
  const referencias = (lista ?? []).filter((item): item is string | number => typeof item === "string" || typeof item === "number").map(String);
  if (!referencias.length) {
    throw new Error("Manda productos: [id, código Odoo o código de barras] y activo: true o false");
  }
  if (referencias.length > LOTE_MAX) {
    throw new Error(`Manda hasta ${LOTE_MAX} productos por llamada`);
  }
  if (body.activo === undefined && body.categoria === undefined) {
    throw new Error("Manda activo: true o false, o categoria");
  }
  const { ids, faltan } = await resolverProductos(referencias);
  if (!ids.size) {
    throw new NoEncontrado("No encontramos ninguno de esos productos en el catálogo");
  }
  const { updated } = await batchUpdateAdminCatalogProducts({
    ids: Array.from(new Set(ids.values())),
    activo: body.activo,
    categoria: body.categoria,
    por: actor,
  });
  return NextResponse.json({ actualizados: updated, noEncontrados: faltan });
}

export function productoError(error: unknown, fallback: string, logLabel: string): NextResponse {
  if (error instanceof NoEncontrado) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return catalogoError(error, fallback, logLabel);
}
