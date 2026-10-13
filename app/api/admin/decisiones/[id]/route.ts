import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { handleResponderDecision, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleResponderDecision(params.id, request);
  } catch (error) {
    return operacionError(error, "No pudimos guardar la decisión", "[admin] decision");
  }
}
