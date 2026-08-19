// TEMPORAL - eliminar este endpoint después de diagnosticar el token de WhatsApp

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIAGNOSTIC_KEY = "diagnostico123";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== DIAGNOSTIC_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return NextResponse.json(
      { error: "Missing WhatsApp environment variables" },
      { status: 500 }
    );
  }

  const graphUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`;

  const graphResponse = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const raw = await graphResponse.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    // Meta a veces responde texto plano; devolverlo tal cual.
  }

  return NextResponse.json({
    status: graphResponse.status,
    body,
  });
}
