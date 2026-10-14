import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { bancoError, handleImportarBanco, handleListarBanco } from "@/lib/banco-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleListarBanco(request);
  } catch (error) {
    return bancoError(error, "No pudimos leer el banco", "[admin] banco");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleImportarBanco(request, "admin");
  } catch (error) {
    return bancoError(error, "No pudimos importar el estado de cuenta", "[admin] banco");
  }
}
