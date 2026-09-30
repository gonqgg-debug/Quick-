import { NextResponse } from "next/server";
import { leerNegocioFiscal, reciboDe } from "@/lib/pos-fiscal-server";
import { NEGOCIO_RECIBO_DEFAULT } from "@/lib/pos-fiscal";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }
  try {
    const { negocio, persistido } = await leerNegocioFiscal();
    return NextResponse.json({ negocio: persistido ? reciboDe(negocio) : NEGOCIO_RECIBO_DEFAULT });
  } catch (error) {
    console.error("[pos] fiscal", error);
    return NextResponse.json({ negocio: NEGOCIO_RECIBO_DEFAULT });
  }
}
