import { MilesPortada } from "@/components/admin/consumo/MilesPortada";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { clasificarPortada } from "@/lib/miles-casos";
import { cargarComplementarios } from "@/lib/miles-complementarios";
import { todayDayKey } from "@/lib/local-day";
import { MilesError } from "@/lib/miles-domain";
import { casosDeInforme, listarAsociaciones, listarEjecuciones, listarHallazgos, listarInformes, listarPruebas, listarTareas } from "@/lib/miles-store";
import { cargarFrescura } from "@/lib/pos-consumo";
import { listarPropuestas } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Miles | Analítica" };

export default async function MilesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const uno = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  try {
    const hoy = todayDayKey();
    const fecha = uno("fecha");
    const seccion = uno("seccion") || "informe";
    const [hallazgos, pruebas, ejecuciones, informes, propuestas, frescura, complementarios, asociaciones] = await Promise.all([
      listarHallazgos({ tienda: "quick", tipo: null, estado: null, prioridad: null, desde: null, hasta: null, limit: 80, cursor: null }),
      listarPruebas(null),
      listarEjecuciones(20),
      listarInformes(40).catch((error: unknown) => {
        if (error instanceof MilesError && error.status === 503) return [];
        throw error;
      }),
      listarPropuestas().catch((error: unknown) => {
        if (error instanceof MilesError && error.status === 503) return [];
        throw error;
      }),
      cargarFrescura().catch(() => null),
      cargarComplementarios({ desde: uno("desde") || null, hasta: uno("hasta") || null, semana: uno("semana") || null, par: uno("par") || null }).catch(() => null),
      listarAsociaciones(40).catch((error: unknown) => {
        if (error instanceof MilesError && error.status === 503) return [];
        throw error;
      }),
    ]);
    const dia = (value: unknown) => String(value ?? "").slice(0, 10);
    const informeId = uno("informe");
    const seleccionado = informeId
      ? informes.find((row) => String(row.id) === informeId) ?? null
      : fecha
        ? informes.find((row) => dia(row.fecha) === fecha) ?? null
        : informes.find((row) => dia(row.fecha) === hoy) ?? null;
    const visible = seleccionado ?? (fecha || informeId ? null : informes[0] ?? null);
    const ejecucion = ejecuciones[0] ?? null;
    const clasificacion = clasificarPortada({
      hoy,
      informeFecha: visible ? dia(visible.fecha) : null,
      informeEstado: visible && (visible.estado === "publicado" || visible.estado === "parcial") ? visible.estado : null,
      ejecucionEstado: ejecucion ? String(ejecucion.estado) : null,
    });
    const casos = visible ? await casosDeInforme(String(visible.id)) : [];
    const idRutina = ejecucion ? String(ejecucion.id) : null;
    const idInforme = visible?.ejecucion_id ? String(visible.ejecucion_id) : null;
    const tareasRutina = idRutina ? await listarTareas(idRutina).catch(() => []) : [];
    const tareasInforme = idInforme && idInforme !== idRutina ? await listarTareas(idInforme).catch(() => []) : idInforme ? tareasRutina : [];
    return (
      <MilesPortada
        seccion={["complementarios", "propuestas", "seguimiento", "rutina"].includes(seccion) ? seccion : "informe"}
        hoy={hoy}
        estado={clasificacion.estado}
        informeEsDeHoy={clasificacion.informeEsDeHoy}
        informe={visible}
        casos={casos}
        historial={informes}
        hallazgos={hallazgos}
        propuestas={propuestas}
        pruebas={pruebas}
        ejecucion={ejecucion}
        tareas={tareasRutina}
        tareasInforme={tareasInforme}
        complementarios={
          complementarios ?? {
            desde: "",
            hasta: "",
            aviso: "No se pudo leer la canasta.",
            paresTotal: 0,
            umbral: "",
            pares: [],
            elegido: null,
            detalle: null,
          }
        }
        asociaciones={asociaciones}
        datosHasta={visible?.datos_hasta ? dia(visible.datos_hasta) : frescura?.ultimaFecha ?? null}
        publicadoEn={visible?.publicado_en ? String(visible.publicado_en) : null}
        q={uno("q")}
        orden={uno("orden")}
        vista={uno("vista")}
      />
    );
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar Miles"} />;
  }
}
