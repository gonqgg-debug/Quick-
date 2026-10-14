import { NextRequest, NextResponse } from "next/server";
import { BANCO_ARCHIVO_MAX, importarEstadoCuenta, listarMovimientos } from "@/lib/banco";
import { facturasError } from "@/lib/facturas-http";
import type { Actor } from "@/lib/operacion-shared";

export function bancoError(error: unknown, fallback: string, logLabel: string): NextResponse {
  return facturasError(error, fallback, logLabel);
}

/**
 * Multipart: archivo (CSV o Excel) más banco, cuenta y moneda como texto.
 * JSON: banco, cuenta, moneda y csv (el texto) o base64 con nombre.
 */
export async function handleImportarBanco(request: NextRequest, actor: Actor) {
  const tipo = request.headers.get("content-type") ?? "";
  let archivo: { buffer: Buffer; nombre: string } | null = null;
  let opciones: { banco: unknown; cuenta?: unknown; moneda?: unknown };
  if (tipo.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("archivo") ?? form.get("file") ?? form.get("estado");
    if (file && typeof file !== "string") {
      if (file.size > BANCO_ARCHIVO_MAX) {
        throw new Error("El archivo pasa de 4 MB");
      }
      archivo = { buffer: Buffer.from(await file.arrayBuffer()), nombre: file.name || "estado.csv" };
    }
    opciones = { banco: form.get("banco"), cuenta: form.get("cuenta"), moneda: form.get("moneda") };
  } else {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new Error("El cuerpo tiene que ser un JSON o multipart");
    }
    const nombre = typeof body.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : "estado.csv";
    if (typeof body.csv === "string" && body.csv.trim()) {
      archivo = { buffer: Buffer.from(body.csv, "utf8"), nombre: nombre.toLowerCase().endsWith(".csv") ? nombre : `${nombre}.csv` };
    } else if (typeof body.base64 === "string" && body.base64.trim()) {
      archivo = { buffer: Buffer.from(body.base64.replace(/^data:[^,]*,/, ""), "base64"), nombre };
    }
    opciones = { banco: body.banco, cuenta: body.cuenta, moneda: body.moneda };
  }
  if (!archivo) {
    throw new Error("Manda el estado de cuenta: archivo en multipart, o csv o base64 en JSON");
  }
  const importacion = await importarEstadoCuenta(archivo, opciones, actor);
  return NextResponse.json({ importacion }, { status: 201 });
}

export async function handleListarBanco(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tipo = params.get("tipo");
  const movimientos = await listarMovimientos({
    desde: params.get("desde"),
    hasta: params.get("hasta"),
    tipo: tipo === "debito" || tipo === "credito" ? tipo : null,
    sinLigar: params.get("sinLigar") === "true",
  });
  return NextResponse.json({ movimientos });
}
