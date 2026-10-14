import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { correrRecordatorios } from "@/lib/factura-recordatorios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await correrRecordatorios();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] facturas", error);
    return NextResponse.json({ error: "No pudimos correr los recordatorios de facturas" }, { status: 500 });
  }
}
