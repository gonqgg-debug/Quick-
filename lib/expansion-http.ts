import { NextRequest, NextResponse } from "next/server";
import {
  EXPANSION_AGENT_ENDPOINTS,
  EXPANSION_AGENT_USO,
  EXPANSION_CARGOS_SUGERIDOS,
  EXPANSION_ETAPAS,
  EXPANSION_FUENTES,
  EXPANSION_META_IDS,
  EXPANSION_TIPOS_ACTIVIDAD,
  EXPANSION_TIPOS_CONTACTO,
  EXPANSION_TRATOS,
  expansionMetaCopy,
  parseClave,
} from "@/lib/expansion-shared";
import {
  createExpansionActividad,
  createExpansionContacto,
  createExpansionSitio,
  getExpansionContacto,
  getExpansionSitio,
  listExpansionActividades,
  listExpansionContactos,
  listExpansionSitios,
  loadExpansionPipeline,
  updateExpansionContacto,
  updateExpansionMetas,
  updateExpansionSitio,
} from "@/lib/expansion";

function statusFor(message: string): number {
  if (message.startsWith("No encontramos")) {
    return 404;
  }
  if (message.includes("ya pertenece")) {
    return 409;
  }
  if (message.startsWith("El ") || message.startsWith("La ") || message.startsWith("Esa clave")) {
    return 400;
  }
  return 500;
}

export function expansionError(error: unknown, fallback: string, logLabel: string): NextResponse {
  const message = error instanceof Error && error.message ? error.message : fallback;
  const status = statusFor(message);
  if (status === 500) {
    console.error(logLabel, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
  }
  return NextResponse.json({ error: message }, { status });
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("El cuerpo no es un JSON válido");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("El cuerpo tiene que ser un objeto JSON");
  }
  return body as Record<string, unknown>;
}

export function expansionVocabulario() {
  return {
    version: 1,
    uso: EXPANSION_AGENT_USO,
    etapas: EXPANSION_ETAPAS,
    tratos: EXPANSION_TRATOS,
    tiposContacto: EXPANSION_TIPOS_CONTACTO,
    tiposActividad: EXPANSION_TIPOS_ACTIVIDAD,
    fuentes: EXPANSION_FUENTES,
    cargosSugeridos: EXPANSION_CARGOS_SUGERIDOS,
    metas: EXPANSION_META_IDS.map((id) => ({ id, ...expansionMetaCopy(id) })),
    endpoints: EXPANSION_AGENT_ENDPOINTS,
  };
}

export async function handleExpansionOverview() {
  const pipeline = await loadExpansionPipeline();
  return NextResponse.json({ ...expansionVocabulario(), pipeline });
}

export async function handleAdminExpansionBoard() {
  const [pipeline, sitios, contactos] = await Promise.all([
    loadExpansionPipeline(),
    listExpansionSitios(),
    listExpansionContactos(),
  ]);
  return NextResponse.json({ pipeline, sitios, contactos, vocabulario: expansionVocabulario() });
}

export async function handleListContactos(request: NextRequest) {
  const contactos = await listExpansionContactos(request.nextUrl.searchParams.get("q"));
  return NextResponse.json({ contactos });
}

export async function handleCreateContacto(request: NextRequest) {
  const result = await createExpansionContacto(await readJson(request));
  return NextResponse.json(result, { status: result.creado ? 201 : 200 });
}

export async function handleGetContacto(idOrClave: string) {
  const contacto = await getExpansionContacto(idOrClave);
  if (!contacto) {
    return NextResponse.json({ error: "No encontramos ese contacto" }, { status: 404 });
  }
  return NextResponse.json({ contacto });
}

export async function handlePatchContacto(idOrClave: string, request: NextRequest) {
  const contacto = await updateExpansionContacto(idOrClave, await readJson(request));
  return NextResponse.json({ contacto });
}

export async function handleListSitios(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const claveRaw = params.get("clave");
  if (claveRaw != null && claveRaw !== "") {
    const clave = parseClave(claveRaw);
    if (!clave.ok || !clave.clave) {
      throw new Error(clave.ok ? "La clave es obligatoria" : clave.message);
    }
    const sitio = await getExpansionSitio(clave.clave);
    return NextResponse.json({ sitios: sitio ? [sitio] : [] });
  }
  const vencidos = params.get("vencidos");
  const sitios = await listExpansionSitios({
    etapa: params.get("etapa"),
    q: params.get("q"),
    vencidos: vencidos === "true" || vencidos === "1",
  });
  return NextResponse.json({ sitios });
}

export async function handleCreateSitio(request: NextRequest) {
  const result = await createExpansionSitio(await readJson(request));
  return NextResponse.json(result, { status: result.creado ? 201 : 200 });
}

export async function handleGetSitio(idOrClave: string) {
  const sitio = await getExpansionSitio(idOrClave);
  if (!sitio) {
    return NextResponse.json({ error: "No encontramos ese sitio" }, { status: 404 });
  }
  const actividades = await listExpansionActividades(sitio.id);
  return NextResponse.json({ sitio, actividades });
}

export async function handlePatchSitio(idOrClave: string, request: NextRequest) {
  const sitio = await updateExpansionSitio(idOrClave, await readJson(request));
  return NextResponse.json({ sitio });
}

export async function handleListActividades(idOrClave: string) {
  const sitio = await getExpansionSitio(idOrClave);
  if (!sitio) {
    return NextResponse.json({ error: "No encontramos ese sitio" }, { status: 404 });
  }
  const actividades = await listExpansionActividades(sitio.id);
  return NextResponse.json({ sitioId: sitio.id, clave: sitio.clave, actividades });
}

export async function handleCreateActividad(idOrClave: string, request: NextRequest) {
  const result = await createExpansionActividad(idOrClave, await readJson(request));
  return NextResponse.json(result, { status: result.creado ? 201 : 200 });
}

export async function handleGetMetas() {
  const pipeline = await loadExpansionPipeline();
  return NextResponse.json({
    metas: pipeline.metas,
    seguimientosVencidos: pipeline.seguimientosVencidos,
    activos: pipeline.activos,
  });
}

export async function handlePatchMetas(request: NextRequest) {
  const metas = await updateExpansionMetas(await readJson(request));
  return NextResponse.json({ metas });
}
