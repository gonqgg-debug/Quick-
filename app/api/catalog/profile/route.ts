import { NextRequest } from "next/server";
import { getActiveOrderSession } from "@/lib/catalog";
import {
  getCustomerForChat,
  parseStructuredAddress,
  saveCustomerProfile,
  type ProfileAddressInput,
} from "@/lib/customers";
import { jsonError } from "@/lib/order-request";

export const dynamic = "force-dynamic";

type ProfileAddressBody = {
  id?: unknown;
  esPredeterminada?: unknown;
  direccion?: unknown;
  etiqueta?: unknown;
  residencial?: unknown;
  edificio?: unknown;
  apartamento?: unknown;
};

type ProfileBody = {
  sessionId?: unknown;
  nombre?: unknown;
  apellido?: unknown;
  addresses?: unknown;
};

function parseAddresses(value: unknown): ProfileAddressInput[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const addresses: ProfileAddressInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const record = item as ProfileAddressBody;
    const fields = parseStructuredAddress(record);
    if (!fields) {
      return null;
    }
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
    addresses.push({
      id,
      esPredeterminada: Boolean(record.esPredeterminada),
      ...fields,
    });
  }
  return addresses;
}

export async function PATCH(request: NextRequest) {
  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return jsonError("El cuerpo de la solicitud no es un JSON válido.", 400);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const apellido = typeof body.apellido === "string" ? body.apellido.trim() : "";
  const addresses = parseAddresses(body.addresses);

  if (!sessionId) {
    return jsonError("Falta la sesión.", 400);
  }
  if (nombre.length < 2) {
    return jsonError("Escribe tu nombre.", 400);
  }
  if (apellido.length < 2) {
    return jsonError("Escribe tu apellido.", 400);
  }
  if (!addresses) {
    return jsonError("Completa al menos una dirección de entrega.", 400);
  }

  const session = await getActiveOrderSession(sessionId);
  if (!session) {
    return jsonError("La sesión no está activa. Solicita un enlace nuevo por WhatsApp.", 409);
  }

  try {
    const customer = await getCustomerForChat(session.chat_id);
    if (!customer) {
      return jsonError("Regístrate antes de editar tu perfil.", 409);
    }
    const updated = await saveCustomerProfile(customer.id, { nombre, apellido, addresses });
    return Response.json({ success: true, customer: updated });
  } catch (error) {
    console.error("[catalog] no se pudo guardar el perfil", error);
    const message = error instanceof Error ? error.message : "No pudimos guardar tus datos";
    return jsonError(message, 500);
  }
}
