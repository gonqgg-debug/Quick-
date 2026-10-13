import { NextRequest, NextResponse } from "next/server";
import { facturasError } from "@/lib/facturas-http";
import {
  abrirDecision,
  abrirExcepcion,
  abrirVersion,
  aprobarCierre,
  cargarCierre,
  guardarConfirmacion,
  listarDecisiones,
  listarExcepciones,
  marcarCompraPersonal,
  publicarAsientos,
  publicarConciliacion,
  publicarEntrega,
  publicarReporte,
  publicarVerificacion,
  resolverExcepcion,
  responderDecision,
} from "@/lib/operacion";
import type { Actor, DecisionEstado } from "@/lib/operacion-shared";

export async function leerJson(request: NextRequest): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("El cuerpo tiene que ser un JSON");
  }
  return body as Record<string, unknown>;
}

export function operacionError(error: unknown, fallback: string, logLabel: string): NextResponse {
  return facturasError(error, fallback, logLabel);
}

export async function handleConfirmacion(id: string, request: NextRequest, actor: Actor) {
  const factura = await guardarConfirmacion(id, await leerJson(request), actor);
  return NextResponse.json({ factura });
}

export async function handleMarca(id: string, request: NextRequest, actor: Actor) {
  const factura = await marcarCompraPersonal(id, await leerJson(request), actor);
  return NextResponse.json({ factura });
}

export async function handleVerificacion(id: string, request: NextRequest, actor: Actor) {
  const factura = await publicarVerificacion(id, await leerJson(request), actor);
  return NextResponse.json({ factura });
}

export async function handleConciliacion(id: string, request: NextRequest, actor: Actor) {
  const factura = await publicarConciliacion(id, await leerJson(request), actor);
  return NextResponse.json({ factura });
}

export async function handleListarDecisiones() {
  const decisiones = await listarDecisiones();
  return NextResponse.json({ decisiones });
}

export async function handleAbrirDecision(request: NextRequest, actor: Actor) {
  const decision = await abrirDecision(await leerJson(request), actor);
  return NextResponse.json({ decision }, { status: 201 });
}

export async function handleResponderDecision(id: string, request: NextRequest) {
  const body = await leerJson(request);
  const respuesta = body.respuesta === "si" || body.respuesta === "no" ? body.respuesta : null;
  if (!respuesta) {
    throw new Error("La respuesta tiene que ser sí o no");
  }
  const decision = await responderDecision(id, respuesta as DecisionEstado);
  return NextResponse.json({ decision });
}

export async function handleListarExcepciones(request: NextRequest) {
  const abiertas = request.nextUrl.searchParams.get("abiertas") === "true";
  const excepciones = await listarExcepciones(abiertas);
  return NextResponse.json({ excepciones });
}

export async function handleAbrirExcepcion(request: NextRequest, actor: Actor) {
  const excepcion = await abrirExcepcion(await leerJson(request), actor);
  return NextResponse.json({ excepcion }, { status: 201 });
}

export async function handleResolverExcepcion(id: string, request: NextRequest, actor: Actor) {
  const excepcion = await resolverExcepcion(id, await leerJson(request), actor);
  return NextResponse.json({ excepcion });
}

export async function handleCierre(mes: string | null) {
  if (!mes) {
    throw new Error("El mes no es válido");
  }
  return NextResponse.json(await cargarCierre(mes));
}

export async function handleAbrirVersion(mes: string) {
  const version = await abrirVersion(mes);
  return NextResponse.json({ version }, { status: 201 });
}

export async function handleAsientos(mes: string, request: NextRequest, actor: Actor) {
  const version = await publicarAsientos(mes, await leerJson(request), actor);
  return NextResponse.json({ version });
}

export async function handleEntrega(mes: string, request: NextRequest, actor: Actor) {
  const version = await publicarEntrega(mes, await leerJson(request), actor);
  return NextResponse.json({ version });
}

export async function handleReporteCierre(mes: string, request: NextRequest, actor: Actor) {
  const version = await publicarReporte(mes, await leerJson(request), actor);
  return NextResponse.json({ version });
}

export async function handleAprobar(mes: string, request: NextRequest, actor: Actor) {
  const cierre = await aprobarCierre(mes, await leerJson(request), actor);
  return NextResponse.json(cierre);
}
