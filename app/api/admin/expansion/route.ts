import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { expansionError, handleAdminExpansionBoard } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleAdminExpansionBoard();
  } catch (error) {
    return expansionError(error, "No pudimos cargar el pipeline de expansión", "[admin] expansion");
  }
}
