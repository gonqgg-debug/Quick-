import { NextRequest, NextResponse } from "next/server";
import { abrirDocumento, leerPeticionFactura } from "@/lib/factura-documentos";
import {
  createFactura,
  filtroDesdeParams,
  getFactura,
  listFacturas,
  responderPregunta,
  resumenFacturas,
  updateFactura,
} from "@/lib/facturas";
import {
  FACTURA_CONDICIONES,
  FACTURA_ESTADOS,
  FACTURA_ESTADOS_LINEA,
  FACTURA_ITBIS_LINEA,
  FACTURA_MONEDAS,
  FACTURA_PRESENTACIONES,
  FACTURA_PREGUNTA_ESTADOS,
  FACTURA_RESULTADOS,
  FACTURA_TIPOS,
  FACTURA_VALIDACIONES,
  FACTURAS_AGENT_ENDPOINTS,
  FACTURAS_AGENT_USO,
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
    message.startsWith("Esa clave") ||
    message.startsWith("Cada foto")
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
    foto: "JPG, PNG, WebP o PDF. Hasta 4 MB por archivo. JSON: fotoBase64 o documentos[{ pagina, base64 }]. Multipart: archivo en el campo foto.",
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

export async function handleCreateFactura(request: NextRequest) {
  const { body, documentos } = await leerPeticionFactura(request);
  const result = await createFactura(body, documentos);
  return NextResponse.json(result, { status: result.creado ? 201 : 200 });
}

export async function handleGetFactura(idOrClave: string) {
  const factura = await getFactura(idOrClave);
  if (!factura) {
    return NextResponse.json({ error: "No encontramos esa factura" }, { status: 404 });
  }
  return NextResponse.json({ factura });
}

export async function handlePatchFactura(idOrClave: string, request: NextRequest) {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, body, documentos);
  return NextResponse.json({ factura });
}

export async function handlePostLineas(idOrClave: string, request: NextRequest) {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, envolverLineas(body), documentos);
  return NextResponse.json({ factura });
}

export async function handlePostValidaciones(idOrClave: string, request: NextRequest) {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, envolverValidaciones(body), documentos);
  return NextResponse.json({ factura });
}

export async function handlePostPreguntas(idOrClave: string, request: NextRequest) {
  const { body, documentos } = await leerPeticionFactura(request);
  const factura = await updateFactura(idOrClave, envolverPreguntas(body), documentos);
  return NextResponse.json({ factura });
}

export async function handlePatchPregunta(idOrClave: string, preguntaId: string, request: NextRequest) {
  const { body } = await leerPeticionFactura(request);
  const factura = await responderPregunta(idOrClave, preguntaId, body);
  return NextResponse.json({ factura });
}

export async function handlePostDocumentos(idOrClave: string, request: NextRequest) {
  const { body, documentos } = await leerPeticionFactura(request);
  if (!documentos.length) {
    throw new Error("Manda la foto en el campo foto, o en fotoBase64");
  }
  const factura = await updateFactura(idOrClave, body, documentos);
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

export async function handleAdminPatch(id: string, request: NextRequest) {
  const { body } = await leerPeticionFactura(request);
  const allowed: Record<string, unknown> = {};
  if ("estado" in body) {
    allowed.estado = body.estado;
  }
  if ("observaciones" in body) {
    allowed.observaciones = body.observaciones;
  }
  const factura = await updateFactura(id, allowed, []);
  return NextResponse.json({ factura });
}
