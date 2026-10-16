import { formatNumero, formatRd } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";
import { graficoAlcanza, type PuntoVisual, type VisualMiles } from "@/lib/miles-presentacion";

export function MilesVisual({ visual, compacto = false }: { visual: VisualMiles; compacto?: boolean }) {
  if (!graficoAlcanza(visual)) {
    return <p className="text-xs text-brand-muted">No hay suficientes puntos para un gráfico.</p>;
  }
  if (visual.tipo === "tendencia") return <Linea puntos={visual.serie} compacto={compacto} />;
  if (visual.tipo === "comparacion") return <Barras puntos={puntosComparacion(visual)} compacto={compacto} />;
  if (visual.tipo === "horarios") return <Mapa puntos={visual.categorias.length ? visual.categorias : visual.serie} compacto={compacto} />;
  if (visual.tipo === "concentracion" || visual.tipo === "calidad") return <Participacion visual={visual} />;
  return <Canasta visual={visual} />;
}

export function textoMetrica(visual: VisualMiles | null): string | null {
  if (!visual?.metrica) return null;
  return formatear(visual.metrica.valor, visual.metrica.unidad);
}

export function textoComparacion(visual: VisualMiles | null): string | null {
  if (!visual?.comparacion || !visual.metrica) return null;
  return `${formatear(visual.comparacion.valor, visual.metrica.unidad)} en ${visual.comparacion.periodo} · ${visual.comparacion.metodo}`;
}

function Linea({ puntos, compacto }: { puntos: PuntoVisual[]; compacto: boolean }) {
  const width = compacto ? 280 : 360;
  const height = compacto ? 72 : 120;
  const min = Math.min(...puntos.map((punto) => punto.valor));
  const max = Math.max(...puntos.map((punto) => punto.valor));
  const span = max - min || 1;
  const coords = puntos.map((punto, index) => {
    const x = 8 + (index * (width - 16)) / Math.max(puntos.length - 1, 1);
    const y = 8 + ((max - punto.valor) / span) * (height - 22);
    return { ...punto, x, y };
  });
  const d = coords.map((punto, index) => `${index === 0 ? "M" : "L"}${punto.x},${punto.y}`).join(" ");
  const etiqueta = coords.map((punto) => `${punto.etiqueta}: ${formatNumero(punto.valor, 2)}`).join(", ");
  return (
    <div>
      <svg role="img" aria-label={`Tendencia. ${etiqueta}`} viewBox={`0 0 ${width} ${height}`} className="w-full">
        <title>{etiqueta}</title>
        <path d={d} fill="none" stroke={brand.green} strokeWidth="2" />
        {coords.map((punto, index) => (
          <circle key={`${punto.etiqueta}-${index}`} cx={punto.x} cy={punto.y} r="2.5" fill={brand.ink}>
            <title>{`${punto.etiqueta}: ${formatNumero(punto.valor, 2)}`}</title>
          </circle>
        ))}
        <text x="8" y={height - 2} fontSize="9" fill={brand.muted}>{coords[0]?.etiqueta}</text>
        <text x={width - 8} y={height - 2} fontSize="9" fill={brand.muted} textAnchor="end">{coords[coords.length - 1]?.etiqueta}</text>
      </svg>
      {compacto ? null : <TablaPuntos puntos={puntos} />}
    </div>
  );
}

function Barras({ puntos, compacto }: { puntos: PuntoVisual[]; compacto: boolean }) {
  const max = Math.max(...puntos.map((punto) => Math.abs(punto.valor)), 1);
  const etiqueta = puntos.map((punto) => `${punto.etiqueta}: ${formatNumero(punto.valor, 2)}`).join(", ");
  return (
    <div role="img" aria-label={`Comparación. ${etiqueta}`} className={compacto ? "space-y-1.5" : "space-y-2"}>
      {puntos.map((punto) => (
        <div key={punto.etiqueta}>
          <div className="flex justify-between gap-2 text-[11px] text-brand-muted">
            <span>{punto.etiqueta}</span>
            <span className="tabular-nums text-brand-ink">{formatNumero(punto.valor, 2)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#F3F4F6]">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(4, (Math.abs(punto.valor) / max) * 100)}%`, backgroundColor: brand.green }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Mapa({ puntos, compacto }: { puntos: PuntoVisual[]; compacto: boolean }) {
  const max = Math.max(...puntos.map((punto) => punto.valor), 1);
  const etiqueta = puntos.map((punto) => `${punto.etiqueta}: ${formatNumero(punto.valor, 2)}`).join(", ");
  return (
    <div>
      <div role="img" aria-label={`Horarios. ${etiqueta}`} className="grid grid-cols-4 gap-1">
        {puntos.map((punto, index) => {
          const fuerza = Math.max(0, punto.valor) / max;
          return (
            <div key={`${punto.etiqueta}-${index}`} className="rounded px-1 py-1 text-[10px] leading-tight" style={{ backgroundColor: `rgba(126, 179, 65, ${0.12 + fuerza * 0.5})`, color: brand.ink }} title={`${punto.etiqueta}: ${formatNumero(punto.valor, 2)}`}>
              <span className="block truncate">{punto.etiqueta}</span>
              <span className="tabular-nums">{formatNumero(punto.valor, 0)}</span>
            </div>
          );
        })}
      </div>
      {compacto ? null : <TablaPuntos puntos={puntos} />}
    </div>
  );
}

function Participacion({ visual }: { visual: VisualMiles }) {
  const numerador = visual.numerador ?? 0;
  const denominador = visual.denominador ?? 0;
  const ancho = Math.max(0, Math.min(100, (numerador / denominador) * 100));
  const etiqueta = `${formatNumero(numerador, 2)} de ${formatNumero(denominador, 2)} (${formatNumero(ancho, 1)}%)`;
  return (
    <div role="img" aria-label={etiqueta}>
      <div className="h-2 rounded-full bg-[#F3F4F6]">
        <div className="h-2 rounded-full" style={{ width: `${ancho}%`, backgroundColor: visual.tipo === "calidad" ? brand.orange : brand.green }} />
      </div>
      <p className="mt-1 text-[11px] tabular-nums text-brand-muted">{etiqueta}</p>
    </div>
  );
}

function Canasta({ visual }: { visual: VisualMiles }) {
  const juntos = visual.numerador ?? 0;
  const muestra = visual.muestra ?? 0;
  const nombres = visual.categorias.map((punto) => punto.etiqueta).filter(Boolean);
  const productos = nombres.length >= 2 ? `${nombres[0]} y ${nombres[1]}` : "Frecuencia conjunta";
  return (
    <p className="text-xs text-brand-ink" role="img" aria-label={`${productos}, ${formatNumero(juntos, 0)} de ${formatNumero(muestra, 0)} tickets`}>
      <span className="font-semibold">{productos}</span>
      <span className="mt-1 block tabular-nums text-brand-muted">{formatNumero(juntos, 0)} de {formatNumero(muestra, 0)} tickets</span>
    </p>
  );
}

function puntosComparacion(visual: VisualMiles): PuntoVisual[] {
  if (visual.serie.length >= 2) return visual.serie.slice(0, 4);
  if (visual.metrica && visual.comparacion) {
    return [
      { etiqueta: visual.comparacion.periodo, valor: visual.comparacion.valor },
      { etiqueta: "Ahora", valor: visual.metrica.valor },
    ];
  }
  return visual.serie;
}

function TablaPuntos({ puntos }: { puntos: PuntoVisual[] }) {
  return (
    <table className="mt-2 w-full text-left text-xs">
      <caption className="sr-only">Valores del gráfico</caption>
      <tbody>
        {puntos.map((punto) => (
          <tr key={`${punto.etiqueta}-${punto.valor}`}>
            <th scope="row" className="py-0.5 pr-2 font-normal text-brand-muted">{punto.etiqueta}</th>
            <td className="py-0.5 text-right tabular-nums">{formatNumero(punto.valor, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatear(valor: number, unidad: "rd" | "numero" | "pct"): string {
  if (unidad === "rd") return formatRd(valor);
  if (unidad === "pct") {
    const ratio = Math.abs(valor) > 1 ? valor / 100 : valor;
    return `${formatNumero(ratio * 100, 1)}%`;
  }
  return formatNumero(valor, Number.isInteger(valor) ? 0 : 2);
}
