import { NextRequest, NextResponse } from "next/server";
import { abrirDocumento, leerPeticionFactura } from "@/lib/factura-documentos";
import { guardarPresentacion } from "@/lib/factura-catalogo";
import {
  aceptarPropuestas,
  asignarProductoLinea,
  candidatosLineas,
  createFactura,
  filtroDesdeParams,
  getFactura,
  listFacturas,
  proponerLineas,
  responderPregunta,
  resumenFacturas,
  updateFactura,
} from "@/lib/facturas";
import type { Actor } from "@/lib/operacion-shared";
import {
  FACTURA_CONDICIONES,
  FACTURA_ESTADOS,
  FACTURA_ESTADOS_LINEA,
  FACTURA_ITBIS_LINEA,
  FACTURA_MONEDAS,
  FACTURA_PRESENTACIONES,
  FACTURA_PREGUNTA_ESTADOS,
  FACTURA_PROPUESTA_ORIGENES,
  FACTURA_RECEPCIONES,
  FACTURA_RESULTADOS,
  FACTURA_TIPOS,
  FACTURA_DOCUMENTO_TIPOS,
  FACTURA_VALIDACIONES,
  FACTURA_VALIDACIONES_AUTOMATICAS,
  FACTURAS_AGENT_ENDPOINTS,
  FACTURAS_AGENT_USO,
  PROPUESTA_UMBRAL,
} from "@/lib/facturas-shared";

function statusFor(message: string): number {
  if (message.startsWith("No encontramos")) {
    return 404;
  }
  if (
    message.startsWith("El ") ||
    message.startsWith("La ") ||
    message.startsWith("Las ") ||
    message.startsWith("Manda ") ||
    message.startsWith("Esa ") ||
    message.startsWith("Ese ") ||
    message.startsWith("Sube ") ||
    message.startsWith("Cada foto") ||
    message.startsWith("Hay ") ||
    message.startsWith("Solo ") ||
    message.startsWith("Phillip ") ||
    message.startsWith("Este ") ||
    message.startsWith("Troy ") ||
    message.startsWith("Todavía ") ||
    message.startsWith("Cada ") ||
    message.startsWith("En la línea") ||
    message.startsWith("El cuerpo")
  ) {
    return 400;
  }
  return 500;
}

export function facturasError(error: unknown, fallback: string, logLabel: string): NextResponse {
  const message = error instanceof Error && error.message ? error.message : fallback;
  if (/does not exist|schema cache/i.test(message)) {
    return NextResponse.json({ error: "Falta crear las tablas de facturas. Corre la migración en Supabase." }, { status: 500 });
  }
  const status = statusFor(message);
  if (status === 500) {
    console.error(logLabel, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
  }
  return NextResponse.json({ error: message }, { status });
}

export function facturasVocabulario() {
  return {
    version: 1,
    uso: FACTURAS_AGENT_USO,
    estados: FACTURA_ESTADOS,
    tiposDocumento: FACTURA_TIPOS,
    condiciones: FACTURA_CONDICIONES,
    monedas: FACTURA_MONEDAS,
    presentaciones: FACTURA_PRESENTACIONES,
    estadosLinea: FACTURA_ESTADOS_LINEA,
    precioIncluyeItbis: FACTURA_ITBIS_LINEA,
    validaciones: FACTURA_VALIDACIONES,
    resultados: FACTURA_RESULTADOS,
    estadosPregunta: FACTURA_PREGUNTA_ESTADOS,
    validacionesAutomaticas: FACTURA_VALIDACIONES_AUTOMATICAS,
    recepciones: FACTURA_RECEPCIONES,
    propuestaOrigenes: FACTURA_PROPUESTA_ORIGENES,
    propuestaUmbral: PROPUESTA_UMBRAL,
    tiposArchivo: FACTURA_DOCUMENTO_TIPOS,
    foto: "JPG, PNG, WebP o PDF. Hasta 4 MB por archivo. JSON: fotoBase64 o documentos[{ pagina, base64 }]. El ticket de pago va en documentos[{ tipo: \"ticket\", base64 }] o ticketBase64. Multipart: archivo en el campo foto, y el ticket en el campo ticket.",
    endpoints: FACTURAS_AGENT_ENDPOINTS,
  };
}

function documentoResponse(file: { bytes: Uint8Array; mime: string; filename: string }): NextResponse {
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function envolverLineas(body: Record<string, unknown>): Record<string, unknown> {
  if ("lineas" in body || "productos" in body) {
    return body;
  }
  if ("descripcion" in body || "descripcionOriginal" in body || "codigo" in body || "codigoSku" in body) {
    return { ...body, lineas: [body] };
  }
  return body;
}

function envolverValidaciones(body: Record<string, unknown>): Record<string, unknown> {
  if ("validaciones" in body) {
    return body;
  }
  if ("codigo" in body || "validacion" in body) {
    return { validaciones: [body] };
  }
  return body;
}

function envolverPreguntas(body: Record<string, unknown>): Record<string, unknown> {
  if ("preguntas" in body) {
    return body;
  }
  if ("pregunta" in body) {
    return { preguntas: [body] };
  }
  return body;
}

export async function handleFacturasOverview(request: NextRequest) {
  const [resumen, facturas] = await Promise.all([resumenFacturas(), listFacturas(filtroDesdeParams(request.nextUrl.searchParams))]);
  return NextResponse.json({ ...facturasVocabulario(), resumen, facturas });
}

export async function handleAdminFacturas(request: NextRequest) {
  const [resumen, facturas] = await Promise.all([resumenFacturas(), listFacturas(filtroDesdeParams(request.nextUrl.searchParams))]);
  return NextResponse.json({ resumen, facturas });
}

export async function handleCreateFactura(request: NextRequest, actor: Actor = "lectura") {
  const { body, documentos } = await leerPeticionFactura(request);
  const result = await createFactura(body, documentos, actor);
  return NextResponse.json(result, { status: result.creado ? 201 : 200 });
}

export async function handleGetFactura(idOrClave: string) {
  const factura = await getFactura(idOrClave);
  if (!factura) {
    return NextResponse.json({ error: "No encontramos esa factura" }, { status: 404 });
  }
  return NextResponse.json({ factura });
}

export async function handlePatchFactura(idOrClave: string, request: NextRequest, actor: Actor = "lectura") {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, body, documentos, actor);
  return NextResponse.json({ factura });
}

export async function handlePostLineas(idOrClave: string, request: NextRequest, actor: Actor = "lectura") {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, envolverLineas(body), documentos, actor);
  return NextResponse.json({ factura });
}

export async function handlePostValidaciones(idOrClave: string, request: NextRequest, actor: Actor = "lectura") {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, envolverValidaciones(body), documentos, actor);
  return NextResponse.json({ factura });
}

export async function handlePostPreguntas(idOrClave: string, request: NextRequest, actor: Actor = "lectura") {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, envolverPreguntas(body), documentos, actor);
  return NextResponse.json({ factura });
}

export async function handlePatchPregunta(idOrClave: string, preguntaId: string, request: NextRequest) {
  const { body } = await leerPeticionFactura(request);
  const factura = await responderPregunta(idOrClave, preguntaId, body);
  return NextResponse.json({ factura });
}

export async function handlePostDocumentos(idOrClave: string, request: NextRequest, actor: Actor = "lectura") {
  const { body, documentos } = await leerPeticionFactura(request);
  if (!documentos.length) {
    throw new Error("Manda la foto en el campo foto, o en fotoBase64");
  }
  const factura = await updateFactura(idOrClave, body, documentos, actor);
  return NextResponse.json({ factura, fotos: factura.numeroDocumentos });
}

export async function handleGetDocumento(idOrClave: string, documentoId: string) {
  const factura = await getFactura(idOrClave);
  if (!factura) {
    return NextResponse.json({ error: "No encontramos esa factura" }, { status: 404 });
  }
  const file = await abrirDocumento(factura.id, documentoId);
  if (!file) {
    return NextResponse.json({ error: "No encontramos esa foto" }, { status: 404 });
  }
  return documentoResponse(file);
}

export async function handleAsignarProducto(idOrClave: string, lineaId: string, request: NextRequest, actor: Actor = "admin") {
  if (actor !== "phillip" && actor !== "admin") {
    throw new Error("Solo Phillip elige el producto del catálogo");
  }
  const { body } = await leerPeticionFactura(request);
  if (!("productoId" in body) && body.aceptarPropuesta !== true && body.aceptar !== true) {
    throw new Error("Manda productoId del catálogo (null para quitarlo) o aceptarPropuesta: true");
  }
  const factura = await asignarProductoLinea(idOrClave, lineaId, body, actor);
  return NextResponse.json({ factura });
}

export async function handleAceptarPropuestas(idOrClave: string, request: NextRequest, actor: Actor) {
  const { body } = await leerPeticionFactura(request).catch(() => ({ body: {} as Record<string, unknown> }));
  return NextResponse.json(await aceptarPropuestas(idOrClave, body, actor));
}

export async function handleCandidatos(idOrClave: string, request: NextRequest) {
  const todas = request.nextUrl.searchParams.get("todas") === "true";
  return NextResponse.json(await candidatosLineas(idOrClave, todas));
}

export async function handleProponerLineas(idOrClave: string, request: NextRequest, actor: Actor) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("El cuerpo no es un JSON válido");
  }
  const payload = Array.isArray(body) ? { propuestas: body } : body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return NextResponse.json(await proponerLineas(idOrClave, payload, actor));
}

export async function handleGuardarPresentacion(request: NextRequest, actor: Actor) {
  const { body } = await leerPeticionFactura(request);
  return NextResponse.json({ presentacion: await guardarPresentacion(body, actor) });
}

export async function handleAdminPatch(id: string, request: NextRequest) {
  const { body } = await leerPeticionFactura(request);
  const allowed: Record<string, unknown> = {};
  if ("estado" in body) {
    allowed.estado = body.estado;
  }
  if ("observaciones" in body) {
    allowed.observaciones = body.observaciones;
  }
  const factura = await updateFactura(id, allowed, [], "admin");
  return NextResponse.json({ factura });
}
