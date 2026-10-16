import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { isDayKey } from "@/lib/local-day";
import { MilesError } from "@/lib/miles-domain";
import { respuestaMiles } from "@/lib/miles-http";
import { listarPropuestas, pedirPropuestas } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const params = request.nextUrl.searchParams;
  try {
    const rows = await listarPropuestas();
    const producto = params.get("producto");
    const hallazgo = params.get("hallazgo");
    const filtradas = rows.filter((row) => {
      if (hallazgo) {
        const hallazgos = Array.isArray(row.hallazgos) ? row.hallazgos : [];
        if (!hallazgos.some((item) => String((item as { id?: string }).id) === hallazgo)) return false;
      }
      if (producto) {
        const productos = Array.isArray(row.productos) ? row.productos : [];
        if (!productos.some((item) => String((item as { productId?: string }).productId) === producto)) return false;
      }
      return true;
    });
    return NextResponse.json({ propuestas: filtradas });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    const objetivo = typeof body.objetivo === "string" ? body.objetivo.trim() : "";
    if (objetivo.length < 8) throw new MilesError(400, "Escribe el objetivo");
    const desde = typeof body.desde === "string" ? body.desde : "";
    const hasta = typeof body.hasta === "string" ? body.hasta : "";
    if (!isDayKey(desde) || !isDayKey(hasta) || desde > hasta) throw new MilesError(400, "El periodo de referencia tiene que ser válido");
    if (body.tienda != null && body.tienda !== "quick") throw new MilesError(403, "Esa tienda no está autorizada");
    if (body.hallazgoId != null && body.hallazgoId !== "" && (typeof body.hallazgoId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.hallazgoId))) {
      throw new MilesError(400, "hallazgoId tiene que ser un id");
    }
    const creada = await pedirPropuestas({
      pregunta: `Propuestas de combos y promos: ${objetivo}`.slice(0, 500),
      solicitante: admin.email ?? "admin",
      hallazgoId: typeof body.hallazgoId === "string" ? body.hallazgoId : null,
      alcance: {
        solicitud: "propuestas",
        tienda: "quick",
        objetivo,
        productos: typeof body.productos === "string" ? body.productos.slice(0, 300) : "",
        categorias: typeof body.categorias === "string" ? body.categorias.slice(0, 300) : "",
        desde,
        hasta,
        restricciones: typeof body.restricciones === "string" ? body.restricciones.slice(0, 1000) : "",
      },
    });
    return NextResponse.json(
      {
        id: creada.id,
        estado: creada.estado,
        aviso: "Quedó pendiente. Miles todavía no la ha tomado y no se generó ninguna propuesta.",
      },
      { status: 201 },
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
