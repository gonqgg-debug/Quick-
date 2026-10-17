import {
  aplicarSesion,
  aplicarVentaDiaria,
  costoVigenteConsumo,
  dowOperativo,
  estadoPosVacio,
  fechaOperativaDe,
  fijarVentaManual,
  formatUnidades,
  itbisIncluido,
  margenConsumo,
  metodoCanon,
  parsePosIngestBody,
  relojLocal,
  parseComparacion,
  parseOrden,
  resolverPeriodo,
  ventanasSemana,
  tasaCatalogo,
  ventaDelDia,
  ventaDifiere,
  ventaSinItbis,
  type PosNormalizado,
} from "../lib/pos-domain";
import { anioAnterior, asociacionCanasta, coberturaDeFechas, desgloseVenta, estadoComparacion, estadoHora, participacion, promedioOcurrencia, resolverComparacion, variacionPct } from "../lib/consumo-metricas";
import { describirPeriodo, estadoCosto, margenAgregado, subtituloProducto, variacionAgregada, variacionProducto } from "../lib/consumo-productos-ui";
import { celdaCsv, csvProductos, etiquetaVariacion, etiquetaVariacionTotal } from "../lib/productos-analitica";
import { CONSULTAS_MILES, MilesError, hashPayload, parseAvanceInvestigacion, parseCierreRun, parseEvidencia, parseHallazgo } from "../lib/miles-domain";
import { calcularPromo, revisarAritmetica, supuestosVacios } from "../lib/promo-calculo";
import { parseCorreccionPropuesta, parsePropuesta } from "../lib/promo-domain";
import { indicadoresPromo, ordenAtencion, probabilidadCompleta } from "../lib/promo-presentacion";
import { clasificarHallazgo, formatoDiaComercial, formatoInstante, graficoAlcanza, leerVisual, recomendacionActual, visualCoherente } from "../lib/miles-presentacion";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function sesion(odooId: number, nombre: string, total: number, startAt: string, ordenOdooId: number, fechaOrden: string, lineas: PosNormalizado["ordenes"][number]["lineas"] = []): PosNormalizado {
  return {
    tienda: "quick",
    modo: "completo",
    loteId: null,
    impuestos: [],
    sesion: {
      odooId,
      nombre,
      odooConfigId: 1,
      estado: "closed",
      startAt,
      stopAt: null,
      totalPagos: total,
      efectivoInicial: null,
      efectivoFinal: null,
      odooWriteDate: null,
    },
    ordenes: [
      {
        odooId: ordenOdooId,
        nombre: null,
        posReference: null,
        fecha: fechaOrden,
        total,
        impuesto: null,
        pagado: total,
        cambio: 0,
        estado: "done",
        ncf: null,
        clienteOdooId: null,
        empleadoOdooId: null,
        lineas,
        pagos: [
          {
            odooId: ordenOdooId + 100000,
            metodoOdooId: 1,
            metodo: "Efectivo",
            monto: total,
            fecha: fechaOrden,
            esCambio: false,
            tipoTarjeta: null,
          },
        ],
      },
    ],
  };
}

const oct15am = sesion(839, "POS/00839", 15310, "2026-10-15T14:00:00.000Z", 839001, "2026-10-15T15:00:00.000Z");
const oct15pm = sesion(840, "POS/00840", 69765, "2026-10-15T18:00:00.000Z", 840001, "2026-10-16T04:30:00.000Z");
const oct14am = sesion(837, "POS/00837", 15880, "2026-10-14T14:00:00.000Z", 837001, "2026-10-14T15:00:00.000Z");
const oct14pm = sesion(838, "POS/00838", 47915, "2026-10-14T18:00:00.000Z", 838001, "2026-10-14T22:00:00.000Z");

let estado = estadoPosVacio();
estado = aplicarSesion(estado, oct15am, new Map()).estado;
estado = aplicarSesion(estado, oct15pm, new Map()).estado;
estado = aplicarSesion(estado, oct14am, new Map()).estado;
estado = aplicarSesion(estado, oct14pm, new Map()).estado;

assert(ventaDelDia(estado, "quick", "2026-10-15") === 85075, `15-oct debe ser 85075, fue ${ventaDelDia(estado, "quick", "2026-10-15")}`);
assert(ventaDelDia(estado, "quick", "2026-10-14") === 63795, `14-oct debe ser 63795, fue ${ventaDelDia(estado, "quick", "2026-10-14")}`);

const antes = estado.ordenes.size;
const reenvio = aplicarSesion(estado, oct15pm, new Map());
assert(reenvio.estado.ordenes.size === antes, "reenviar la sesión no duplica órdenes");
assert(reenvio.insertados.ordenes === 0 && reenvio.actualizados.ordenes === 1, "el reenvío actualiza, no inserta");
assert(reenvio.borrados.ordenes === 0, "el mismo payload no borra órdenes");
assert(ventaDelDia(reenvio.estado, "quick", "2026-10-15") === 85075, "el día sigue en 85075");

const madrugada = relojLocal("2026-10-16T04:30:00.000Z");
assert(madrugada.hora === 0, `00:30 en Santo Domingo es hora 0, fue ${madrugada.hora}`);
assert(fechaOperativaDe("2026-10-15T18:00:00.000Z") === "2026-10-15", "la sesión de las 14:00 local abre el 15");
const ordenPm = reenvio.estado.ordenes.get("quick:840001");
assert(ordenPm?.fechaOperativa === "2026-10-15", "la orden de las 00:30 queda en el día de apertura");
assert(ordenPm?.horaLocal === 0, "esa orden es hora local 0");
assert(ordenPm?.dow === dowOperativo("2026-10-15"), "el dow es el del día operativo");
assert(dowOperativo("2026-10-15") === 4, "el 15-oct-2026 es jueves");

const catalogo = new Map<string, string>([["__export__.product_template_1", "producto-1"]]);
const conLinea = sesion(841, "POS/00841", 100, "2026-10-15T14:00:00.000Z", 841001, "2026-10-15T16:00:00.000Z", [
  {
    odooId: 1,
    odooProductId: 9,
    odooTmplId: 9,
    codigoOdoo: "__export__.product_template_9",
    nombreOdoo: "Agua",
    cantidad: 2,
    precioUnit: 25,
    descuento: 0,
    subtotal: 42.37,
    subtotalConItbis: 50,
    odooRefundedLineId: null,
    tasaItbis: null,
    impuestoOdooIds: [],
  },
]);
const cruce = aplicarSesion(estadoPosVacio(), conLinea, catalogo);
const linea = Array.from(cruce.estado.lineas.values())[0];
assert(linea?.matchEstado === "sin_match" && linea.productId == null, "sin código en el catálogo queda sin match");
assert(catalogo.size === 1, "no se crea ningún producto");
assert(cruce.sinMatch === 1, "el conteo de sin match es 1");

assert(margenConsumo(100, 4, null) === null, "sin costo el margen es null");
assert(margenConsumo(100, 4, null) !== 0, "sin costo no es cero");
const manual = costoVigenteConsumo(8, 12);
assert(manual.origen === "manual" && manual.costo === 8, "el costo manual gana");
const factura = costoVigenteConsumo(null, 12);
assert(factura.origen === "factura" && factura.costo === 12, "sin manual se usa la factura");
assert(formatUnidades(4) === "4", "unidades enteras no llevan decimal");
assert(formatUnidades(4.5) === "4.5", "unidades con fracción llevan un decimal");
assert(ventaSinItbis(118) === 100, "118 cobrados con ITBIS incluido tienen base 100");
assert(itbisIncluido(118) === 18, "el ITBIS incluido en 118 es 18");
assert(margenConsumo(100, 4, factura.costo) === 44.07, "el margen saca el ITBIS de 18 de la venta y del costo de 48");
assert(margenConsumo(100, 4, 12, 0) === 52, "con ITBIS 0 el margen es venta menos costo");
assert(margenConsumo(116, 1, 100, 16) === 13.79, "con ITBIS 16, 116 cobrados y costo 100 dejan 13.79");
assert(ventaSinItbis(116, 16) === 100, "116 con tasa 16 tienen base 100");

const sucio = parsePosIngestBody({
  sesiones: [{ sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed", standard_price: 10 }, ordenes: [] }],
});
assert(!sucio.ok && sucio.status === 422 && sucio.campo === "standard_price", "standard_price se rechaza con el campo");

const objeto = parsePosIngestBody({
  sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
  ordenes: [],
});
assert(objeto.ok && objeto.payload.modo === "completo" && objeto.payload.loteId === null, "el cuerpo acepta un objeto sesion");

const ambas = parsePosIngestBody({
  sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
  sesiones: [{ sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" }, ordenes: [] }],
});
assert(!ambas.ok && ambas.status === 422 && ambas.campo === "sesiones", "sesion y sesiones juntas son 422");

const sinInicio = parsePosIngestBody({ sesion: { odooId: 1 }, ordenes: [] });
assert(!sinInicio.ok && sinInicio.status === 422 && sinInicio.campo === "sesion.startAt", "falta startAt responde el campo");

const sinLote = parsePosIngestBody({
  modo: "parcial",
  sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
  ordenes: [],
});
assert(!sinLote.ok && sinLote.status === 422 && sinLote.campo === "loteId", "parcial sin loteId es 422");

const idComoTasa = parsePosIngestBody({
  sesiones: [{
    sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
    ordenes: [{
      odooId: 10,
      fecha: "2026-10-15T15:00:00Z",
      total: 50,
      estado: "paid",
      lineas: [{ odooId: 1, odooProductId: 1, cantidad: 1, tax_ids: [18] }],
      pagos: [],
    }],
  }],
});
const lineaId = idComoTasa.ok ? idComoTasa.payload.ordenes[0]?.lineas[0] : null;
assert(idComoTasa.ok && lineaId?.tasaItbis === null && lineaId.impuestoOdooIds[0] === 18, "tax_ids numerico es un id, no la tasa");

const conAmount = parsePosIngestBody({
  sesiones: [{
    sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
    ordenes: [{
      odooId: 11,
      fecha: "2026-10-15T15:00:00Z",
      total: 50,
      estado: "paid",
      lineas: [{ odooId: 2, odooProductId: 1, cantidad: 1, tax_ids: [{ id: 5, amount: 18 }] }],
      pagos: [],
    }],
  }],
});
const lineaAmount = conAmount.ok ? conAmount.payload.ordenes[0]?.lineas[0] : null;
assert(conAmount.ok && lineaAmount?.tasaItbis === null && lineaAmount.impuestoOdooIds[0] === 5, "tax_ids.amount no es la tasa");

const parOdoo = parsePosIngestBody({
  sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
  ordenes: [{
    odooId: 12,
    fecha: "2026-10-15T15:00:00Z",
    total: 50,
    estado: "paid",
    lineas: [{ odooId: 3, odooProductId: 1, cantidad: 1, tax_ids: [[7, "ITBIS 16%"]] }],
    pagos: [],
  }],
});
const lineaPar = parOdoo.ok ? parOdoo.payload.ordenes[0]?.lineas[0] : null;
assert(parOdoo.ok && lineaPar?.tasaItbis === null && lineaPar.impuestoOdooIds[0] === 7, "el par [id, nombre] guarda el id");

const explicita = parsePosIngestBody({
  impuestos: [{ id: 5, tasa: 16 }, { id: 5, tasa: 0 }],
  sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
  ordenes: [{
    odooId: 13,
    fecha: "2026-10-15T15:00:00Z",
    total: 50,
    estado: "paid",
    lineas: [{ odooId: 4, odooProductId: 1, cantidad: 1, tasaItbis: 0, tax_ids: [5] }],
    pagos: [],
  }],
});
const lineaExplicita = explicita.ok ? explicita.payload.ordenes[0]?.lineas[0] : null;
assert(
  explicita.ok && lineaExplicita?.tasaItbis === 0 && lineaExplicita.impuestoOdooIds[0] === 5 && explicita.payload.impuestos[0]?.tasa === 0,
  "tasaItbis explicito gana y el mapa id a tasa queda en el payload",
);

const tasaMala = parsePosIngestBody({
  sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" },
  ordenes: [{
    odooId: 14,
    fecha: "2026-10-15T15:00:00Z",
    total: 50,
    lineas: [{ odooId: 5, odooProductId: 1, cantidad: 1, tasaItbis: 5 }],
    pagos: [],
  }],
});
assert(!tasaMala.ok && tasaMala.status === 422 && tasaMala.campo === "lineas.tasaItbis", "una tasa que no es 0, 16 o 18 es 422");
assert(tasaCatalogo(16) === 16 && tasaCatalogo(null) === null && tasaCatalogo(7) === 18, "la tasa del catalogo solo acepta 0, 16 y 18");

const dos = parsePosIngestBody({
  sesiones: [
    { sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed" }, ordenes: [] },
    { sesion: { odooId: 2, startAt: "2026-10-15T18:00:00Z", estado: "closed" }, ordenes: [] },
  ],
});
assert(!dos.ok && dos.status === 413, "dos sesiones son 413");

const muchas = {
  sesiones: [
    {
      sesion: { odooId: 1, nombre: "POS/1", estado: "closed", startAt: "2026-10-15T14:00:00Z", totalPagos: 1 },
      ordenes: [
        {
          odooId: 10,
          fecha: "2026-10-15T15:00:00Z",
          total: 1,
          lineas: Array.from({ length: 1501 }, (_, index) => ({
            odooId: index + 1,
            odooProductId: 1,
            codigoOdoo: "__export__.product_template_1",
            nombreOdoo: "Agua",
            cantidad: 1,
          })),
          pagos: [],
        },
      ],
    },
  ],
};
const exceso = parsePosIngestBody(muchas);
assert(!exceso.ok && exceso.status === 413, "1.501 líneas son 413");

const fijada = fijarVentaManual(null, 90000);
const pisada = aplicarVentaDiaria(fijada, 85075);
assert(pisada.overrideManual && pisada.ventaReal === 90000 && pisada.ventaPos === 85075, "el override no pisa venta_real");
assert(ventaDifiere(pisada), "avisa si el monto fijado difiere de la caja");
const libre = aplicarVentaDiaria(null, 85075);
assert(libre.ventaReal === 85075 && libre.origen === "pos" && !libre.overrideManual, "sin override la venta del día es la de la caja");

assert(metodoCanon("TC-CARDNET") === "tarjeta", "CARDNET es tarjeta");
assert(metodoCanon("Banco") === "banco", "Banco no se mete en tarjeta");
assert(metodoCanon("Cuenta de cliente") === "credito", "cuenta de cliente es crédito");

const periodo = resolverPeriodo({ preset: "7d", comparar: "1" }, Date.parse("2026-10-16T12:00:00Z"));
assert(periodo.hasta === "2026-10-16", "el periodo cierra hoy en Santo Domingo");
assert(periodo.desde === "2026-10-10", "7 días incluyen hoy");
const mesAnterior = resolverPeriodo({ preset: "mes_anterior" }, Date.parse("2026-10-16T16:00:00Z"));
assert(mesAnterior.desde === "2026-09-01" && mesAnterior.hasta === "2026-09-30" && mesAnterior.preset === "mes_anterior", "mes anterior es el mes calendario cerrado");
const enero = resolverPeriodo({ preset: "mes_anterior" }, Date.parse("2026-01-15T16:00:00Z"));
assert(enero.desde === "2025-12-01" && enero.hasta === "2025-12-31", "mes anterior en enero cruza de año");
assert(parseOrden("venta_asc") === "venta_asc" && parseOrden("margen_asc") === "margen_asc" && parseOrden("no") === "venta", "el orden acepta ascendente y rechaza basura");
assert(etiquetaVariacion(null, null).tipo === "sin_base", "sin fila anterior no es una venta nueva");
assert(etiquetaVariacion(0, null).tipo === "nuevo", "venta anterior en cero es nuevo");
assert(etiquetaVariacion(10, 0.25).tipo === "pct" && etiquetaVariacion(10, Number.POSITIVE_INFINITY).tipo === "sin_base", "una variación no finita no se muestra");
assert(etiquetaVariacionTotal(20, 0).tipo === "sin_base" && etiquetaVariacionTotal(null, 10).tipo === "sin_base", "el total no usa infinito ni llama nuevo a una base en cero");
assert(margenAgregado(10, 0) === null && margenAgregado(null, 40) === null && margenAgregado(10, 40) === 0.25, "el margen agregado no promedia porcentajes ni usa venta sin costo");
assert(celdaCsv("=cmd") === "'=cmd" && !csvProductos([], 0, false).includes("Infinity"), "el csv no ejecuta fórmulas ni escribe infinito");
assert(periodo.tramo?.hasta === "2026-10-15" && periodo.anterior.desde === "2026-10-04" && periodo.anterior.hasta === "2026-10-09", "la comparación de un periodo en curso usa días completos");
const completos = resolverPeriodo({ preset: "7c", comparacion: "semana" }, Date.parse("2026-10-16T12:00:00Z"));
assert(completos.desde === "2026-10-09" && completos.hasta === "2026-10-15" && completos.comparacion === "semana", "7 días completos terminan ayer y leen el modo de comparación");
assert(completos.anterior.desde === "2026-10-02" && completos.anterior.hasta === "2026-10-08", "mismos días de una semana completa corren 7 días");
const mesPrevio = resolverPeriodo({ preset: "mes_anterior" }, Date.parse("2026-10-16T12:00:00Z"));
assert(mesPrevio.desde === "2026-09-01" && mesPrevio.hasta === "2026-09-30", "mes anterior es el mes calendario cerrado");
const dias30 = resolverPeriodo({ preset: "30c" }, Date.parse("2026-10-16T12:00:00Z"));
assert(dias30.hasta === "2026-10-15" && dias30.desde === "2026-09-16", "30 días completos terminan ayer");
const aviso = describirPeriodo(periodo);
assert(aviso.aviso != null && aviso.aviso.includes("día en curso"), "un periodo que incluye hoy explica el tramo efectivo");
assert(variacionProducto("ok", null, null)?.texto === "Nuevo", "sin fila anterior el producto es nuevo");
assert(variacionProducto("ok", null, 0)?.texto === "Sin base", "venta anterior cero no es un porcentaje");
assert(variacionProducto("ok", Number.POSITIVE_INFINITY, 0)?.texto === "Sin base", "una base cero no se muestra como infinito");
assert(variacionProducto("no_disponible", 0.2, 10)?.texto === "Comparación no disponible", "sin cobertura no hay variación");
assert(variacionProducto("off", 0.2, 10) == null, "sin comparación no hay variación");
assert(variacionAgregada("ok", 110, 100)?.texto.includes("ventas") && variacionAgregada("sin_base", 10, 0)?.texto === "Sin base", "el total usa texto y no promedia porcentajes");
assert(margenAgregado(40, 200) === 0.2 && margenAgregado(null, 200) == null && margenAgregado(40, 0) == null, "el margen agregado usa la venta neta con costo");
assert(estadoCosto(null, null) === "sin_costo" && estadoCosto("factura", 0) === "estimado" && estadoCosto("manual", 8) === "disponible", "costo cero no es costo ausente");
assert(subtituloProducto({ nombre: "Agua Brava 16oz", marca: "Brava", codigo: "A1" }) === "A1", "la marca que ya está en el nombre no se repite");
const semana = resolverComparacion("2026-10-10", "2026-10-15", "semana", Date.parse("2026-10-16T12:00:00Z"));
assert(semana.anterior?.desde === "2026-10-03" && semana.anterior.hasta === "2026-10-08", "mismos días de la semana corren 7 días");
assert(parseComparacion("semana anterior") === "semana" && parseComparacion("semana_anterior") === "semana", "semana anterior no es el periodo inmediato");
const diaSemana = resolverComparacion("2026-10-16", "2026-10-16", parseComparacion("semana anterior"), Date.parse("2026-10-17T12:00:00Z"));
assert(diaSemana.anterior?.desde === "2026-10-09" && diaSemana.anterior.hasta === "2026-10-09", "un día con semana anterior cae en el mismo día de la semana pasada");
assert(diaSemana.anterior?.desde !== "2026-10-15", "semana anterior no es el día previo");
const viernes = ventanasSemana("2026-10-16");
assert(viernes.actual.desde === "2026-10-12" && viernes.actual.hasta === "2026-10-16", "la semana del resumen llega hasta el corte");
assert(viernes.anterior.desde === "2026-10-05" && viernes.anterior.hasta === "2026-10-09", "la semana anterior del resumen repite lunes a viernes");
const lunes = ventanasSemana("2026-10-12");
assert(lunes.actual.desde === "2026-10-12" && lunes.actual.hasta === "2026-10-12" && lunes.anterior.desde === "2026-10-05" && lunes.anterior.hasta === "2026-10-05", "el lunes se compara con el lunes anterior, no con el domingo");
assert(anioAnterior("2024-02-29") === "2023-02-28", "el 29 de febrero cae en el 28");
assert(variacionPct(10, 0) === null && estadoComparacion({ pedida: true, coberturaCompleta: true, base: 0 }) === "sin_base", "base cero no da un porcentaje infinito");
assert(estadoComparacion({ pedida: true, coberturaCompleta: false, base: 10 }) === "no_disponible", "sin cobertura no hay comparación");
assert(!coberturaDeFechas(["2026-10-01"], "2026-10-01", "2026-10-02").completa, "un día sin fila no cuenta como cero");
const efectos = desgloseVenta({ tickets: 12, ticket: 110 }, { tickets: 10, ticket: 100 });
assert(efectos.efectoTickets === 200 && efectos.efectoTicket === 120 && efectos.delta === 320, "tickets y ticket promedio se desglosan en pesos");
assert(participacion(85700, 1123656) != null && Math.round((participacion(85700, 1123656) ?? 0) * 1000) / 10 === 7.6, "la participación usa la venta del periodo");
assert(promedioOcurrencia(100, 4) === 25 && promedioOcurrencia(0, 2) === 0 && promedioOcurrencia(10, 0) === null, "el promedio horario incluye ocurrencias en cero y no divide entre nada");
assert(estadoHora({ ocurrencias: 0, ordenes: 0, incompletas: 0 }) === "sin_datos", "sin sesión no es cerrado");
assert(estadoHora({ ocurrencias: 3, ordenes: 0, incompletas: 0 }) === "abierto_sin_ventas", "hora abierta sin ventas no es cerrada");
const cesta = asociacionCanasta({ elegibles: 10, conA: 4, conB: 3, conAmbos: 2 });
assert(cesta.muestraPequena && cesta.dadoA === 0.5, "una canasta chica no se presenta como conclusión");
const hallazgo = {
  idempotencyKey: "h1",
  tipo: "oportunidad",
  titulo: "Cerveza de noche",
  resumen: "Sube el ticket",
  observacion: "Los viernes después de las 8 sube la venta.",
  interpretacion: "Puede ser el partido.",
  recomendacion: "Probar un combo.",
  prioridad: "media",
  prioridadJustificacion: "El cambio cabe en una semana y la cobertura de costo es alta.",
  periodo: { desde: "2026-10-01", hasta: "2026-10-07" },
  metricas: { venta: 100 },
  evidencia: { consultas: ["consumo_margen_periodo"], filtros: { desde: "2026-10-01" }, enlaces: [{ pantalla: "productos", query: "desde=2026-10-01&hasta=2026-10-07" }] },
};
assert(parseHallazgo(hallazgo).tienda === "quick", "el hallazgo queda en la tienda autorizada");
assert(hashPayload(hallazgo) === hashPayload(hallazgo), "el hash de la publicación es estable");
let rechazo = false;
try {
  parseHallazgo({ ...hallazgo, agent_id: "otro" });
} catch (error) {
  rechazo = error instanceof MilesError;
}
assert(rechazo, "Miles no acepta un agent_id en el cuerpo");
assert(parseCierreRun({ version: 1, estado: "completada" }).estado === "completada", "cerrar una corrida acepta estado completada");
assert(parseCierreRun({ version: 2, estado: "fallida", error: "se cortó" }).estado === "fallida", "cerrar una corrida acepta estado fallida");
let cierreSinEstado = "";
try {
  parseCierreRun({ version: 1 });
} catch (error) {
  cierreSinEstado = error instanceof MilesError ? error.message : "";
}
assert(cierreSinEstado.includes("completada") && !cierreSinEstado.includes("no acepta"), "sin estado el cierre dice que falta, no que Miles lo rechaza");
let hallazgoConEstado = "";
try {
  parseHallazgo({ ...hallazgo, estado: "vigente" });
} catch (error) {
  hallazgoConEstado = error instanceof MilesError ? error.message : "";
}
assert(hallazgoConEstado.includes("no acepta el campo estado"), "un hallazgo sigue sin poder fijar estado");
assert(parseAvanceInvestigacion({ version: 1, estado: "en_analisis" }).estado === "en_analisis", "avanzar una investigación acepta estado");
let tituloLargo = "";
try {
  parseHallazgo({ ...hallazgo, titulo: "a".repeat(170) });
} catch (error) {
  tituloLargo = error instanceof MilesError ? error.message : "";
}
assert(tituloLargo.includes("admite hasta 160") && !tituloLargo.includes("obligatorio"), "un título de 170 caracteres dice el tope");
let tituloVacio = "";
try {
  parseHallazgo({ ...hallazgo, titulo: "   " });
} catch (error) {
  tituloVacio = error instanceof MilesError ? error.message : "";
}
assert(tituloVacio === "titulo es obligatorio", "un título vacío sigue siendo obligatorio");
const evidenciaLarga = parseEvidencia({
  consultas: ["/api/agent/analytics/summary?desde=2026-10-01&hasta=2026-10-16&categoria=tabaco", { nombre: "consumo_mapa_horas" }],
  filtros: { categoria: "tabaco" },
});
assert(evidenciaLarga.consultas.join(",") === "analytics/summary,consumo_mapa_horas", "una ruta con filtros y un objeto nombre son consultas válidas");
assert(parseEvidencia({ consultas: "consumo_margen_periodo", filtros: {} }).consultas[0] === "consumo_margen_periodo", "una consulta puede llegar como string");
let consultaMala = "";
try {
  parseEvidencia({ consultas: ["select * from pos_ordenes"], filtros: {} });
} catch (error) {
  consultaMala = error instanceof MilesError ? error.message : "";
}
assert(consultaMala.includes("no reconoce") && consultaMala.includes("consumo_margen_periodo") && consultaMala.includes(CONSULTAS_MILES[0]), "una consulta desconocida devuelve los nombres válidos");
const grafico = leerVisual({
  tipo: "comparacion",
  metrica: { nombre: "venta", valor: 100, unidad: "rd" },
  serie: [
    { etiqueta: "Antes", valor: 80 },
    { etiqueta: "Ahora", valor: 100 },
  ],
});
assert(grafico.visual?.tipo === "comparacion" && parseHallazgo({ ...hallazgo, visual: grafico.visual }).visual?.metrica?.valor === 100, "el hallazgo acepta una visual declarativa");
assert(leerVisual({ tipo: "tendencia", html: "<b>x</b>", serie: [{ etiqueta: "Lun", valor: 1 }, { etiqueta: "Mar", valor: 2 }] }).error != null, "la visual rechaza HTML");
assert(leerVisual({ tipo: "tendencia", serie: [{ etiqueta: "Lun", valor: 1 }, { etiqueta: "javascript:alert(1)", valor: 2 }] }).error != null, "la visual rechaza javascript");
assert(visualCoherente(grafico.visual, { venta: 100 }).ok && !visualCoherente(grafico.visual, { venta: 50 }).ok, "la visual tiene que coincidir con el snapshot");
assert(graficoAlcanza(leerVisual({ tipo: "tendencia", serie: [{ etiqueta: "Lun", valor: 1 }] }).visual) === false, "un solo punto no alcanza para una tendencia");
const contradictorio = { estado: "vigente", limitaciones: "RESUELTO: la mezcla ya incluye el vuelto.", recomendacion: "No uses la mezcla de pagos." };
assert(clasificarHallazgo(contradictorio) === "requiere_revision", "sin resolución estructurada el hallazgo contradictorio pide revisión");
assert(recomendacionActual(contradictorio) == null, "la instrucción contradictoria deja de mostrarse como recomendación actual");
assert(clasificarHallazgo({ ...contradictorio, resolucion: "resuelta", recomendacion_estado: "obsoleta" }) === "resuelto", "la resolución estructurada cierra la alerta");
assert(recomendacionActual({ ...contradictorio, resolucion: "resuelta", recomendacion_estado: "obsoleta" }) == null, "la recomendación resuelta deja de ser la instrucción actual");
assert(formatoDiaComercial("2026-10-15").includes("15") && formatoDiaComercial("2026-10-15").includes("2026"), "el día comercial no se corre de fecha");
assert(formatoInstante("2026-10-16T04:30:00Z").includes("12:30"), "un timestamp se muestra una sola vez en Santo Domingo");

const cancelada = sesion(850, "POS/00850", 1000, "2026-10-13T14:00:00.000Z", 850001, "2026-10-13T15:00:00.000Z");
cancelada.ordenes[0].estado = "cancel";
const pagada = sesion(851, "POS/00851", 200, "2026-10-13T14:00:00.000Z", 851001, "2026-10-13T16:00:00.000Z");
const devuelta = sesion(852, "POS/00852", -30, "2026-10-13T18:00:00.000Z", 852001, "2026-10-13T20:00:00.000Z");
const borrador = sesion(853, "POS/00853", 40, "2026-10-13T19:00:00.000Z", 853001, "2026-10-13T19:30:00.000Z");
borrador.ordenes[0].estado = "draft";
let dia13 = aplicarSesion(estadoPosVacio(), cancelada, new Map()).estado;
dia13 = aplicarSesion(dia13, pagada, new Map()).estado;
dia13 = aplicarSesion(dia13, devuelta, new Map()).estado;
dia13 = aplicarSesion(dia13, borrador, new Map()).estado;
assert(dia13.ordenes.size === 4, "draft y cancel se guardan");
assert(ventaDelDia(dia13, "quick", "2026-10-13") === 170, `la cancelada no cuenta y la devolución resta, fue ${ventaDelDia(dia13, "quick", "2026-10-13")}`);

let partes = estadoPosVacio();
const parteA = sesion(900, "POS/00900", 10000, "2026-10-12T14:00:00.000Z", 9001, "2026-10-12T15:00:00.000Z");
parteA.modo = "parcial";
parteA.loteId = "lote-1";
parteA.sesion.totalPagos = 99999;
const aplicadaA = aplicarSesion(partes, parteA, new Map());
assert(aplicadaA.alerta === false, "un parcial no marca descuadre");
partes = aplicadaA.estado;
const parteB = sesion(900, "POS/00900", 5000, "2026-10-12T14:00:00.000Z", 9002, "2026-10-12T16:00:00.000Z");
parteB.modo = "parcial";
parteB.loteId = "lote-1";
partes = aplicarSesion(partes, parteB, new Map()).estado;
const ajena = sesion(900, "POS/00900", 999, "2026-10-12T14:00:00.000Z", 9004, "2026-10-12T17:00:00.000Z");
ajena.modo = "parcial";
ajena.loteId = "otro";
partes = aplicarSesion(partes, ajena, new Map()).estado;
const cierre = sesion(900, "POS/00900", 310, "2026-10-12T14:00:00.000Z", 9003, "2026-10-12T18:00:00.000Z");
cierre.modo = "final";
cierre.loteId = "lote-1";
cierre.sesion.totalPagos = 15310;
const cerrada = aplicarSesion(partes, cierre, new Map());
assert(cerrada.estado.ordenes.has("quick:9001") && cerrada.estado.ordenes.has("quick:9002") && cerrada.estado.ordenes.has("quick:9003"), "el final conserva las partes del mismo lote");
assert(!cerrada.estado.ordenes.has("quick:9004"), "el final borra lo que llegó con otro lote");
assert(ventaDelDia(cerrada.estado, "quick", "2026-10-12") === 15310, `las partes suman 15310, fue ${ventaDelDia(cerrada.estado, "quick", "2026-10-12")}`);

const promoBase = {
  idempotencyKey: "promo-1",
  nombre: "Agua con pan",
  objetivo: "Que el pan lleve agua",
  comportamiento: "Sumar agua al ticket del pan.",
  tipo: "combo",
  periodo: { desde: "2026-10-01", hasta: "2026-10-07" },
  productos: [{ productId: "11111111-1111-4111-8111-111111111111", cantidad: 1, funcion: "principal" }],
  mecanica: {},
  evidencia: { solidez: "baja", fundamento: "Periodo corto", consultas: [] },
};
assert(parsePropuesta(promoBase).probabilidad == null && parsePropuesta(promoBase).evidencia.solidez === "baja", "la solidez baja no fabrica un porcentaje");
let promoRechazada = false;
try {
  parsePropuesta({ ...promoBase, estado: "lista_para_probar" });
} catch (error) {
  promoRechazada = error instanceof MilesError && error.status === 403;
}
assert(promoRechazada, "Miles no marca una propuesta como lista para probar");
let htmlRechazado = false;
try {
  parsePropuesta({ ...promoBase, nombre: "<b>combo</b>" });
} catch (error) {
  htmlRechazado = error instanceof MilesError;
}
assert(htmlRechazado, "la propuesta rechaza HTML");
let probabilidadIncompleta = false;
try {
  parsePropuesta({ ...promoBase, probabilidad: { valor: 0.4 } });
} catch (error) {
  probabilidadIncompleta = error instanceof MilesError;
}
assert(probabilidadIncompleta, "una probabilidad sin modelo no entra");
assert(parseCorreccionPropuesta({ version: 1, limitaciones: "Falta el corte" }).patch.limitaciones === "Falta el corte", "Miles puede corregir una limitación");
const mismoImpuesto = calcularPromo({
  tipo: "combo",
  precioCombo: null,
  descuento: null,
  supuestos: { ...supuestosVacios(), ticketsElegibles: 100, yaCompraban: 10, adopcion: 0.1 },
  lineas: [
    { productId: "a", cantidad: 1, precioHabitual: 50, precioPromo: 40.56, costo: 26.4, tasa: 18 },
  ],
});
const central = mismoImpuesto.escenarios.find((escenario) => escenario.nombre === "central");
const basePromo = mismoImpuesto.escenarios.find((escenario) => escenario.nombre === "base");
assert(mismoImpuesto.combinacion.margenHabitual === 20 && mismoImpuesto.combinacion.margen === 12, `el margen por producto usa su tasa, fue ${mismoImpuesto.combinacion.margenHabitual} y ${mismoImpuesto.combinacion.margen}`);
assert(central?.redencionesNuevas === 9 && central.resultado === 28, `las compras nuevas salen de quienes no la llevaban, fue ${central?.redencionesNuevas} y ${central?.resultado}`);
assert(basePromo?.resultado === -80, `la base descuenta a quien ya compraba, fue ${basePromo?.resultado}`);
assert(mismoImpuesto.equilibrio.tasa === 0.0741, `el equilibrio es 0.0741, fue ${mismoImpuesto.equilibrio.tasa}`);
assert(mismoImpuesto.probabilidad == null && !mismoImpuesto.escenarios.some((escenario) => escenario.nombre === "conservador"), "sin adopción extra no hay escenario ni porcentaje");
const tasasMixtas = calcularPromo({
  tipo: "combo",
  precioCombo: 100,
  descuento: null,
  supuestos: supuestosVacios(),
  lineas: [
    { productId: "a", cantidad: 1, precioHabitual: 80, precioPromo: null, costo: 40, tasa: 18 },
    { productId: "b", cantidad: 1, precioHabitual: 40, precioPromo: null, costo: 20, tasa: 0 },
  ],
});
assert(tasasMixtas.combinacion.ingreso === 100 && tasasMixtas.combinacion.margen == null, "un combo con tasas distintas no reparte el ITBIS");
const sinCosto = calcularPromo({
  tipo: "acompanamiento",
  precioCombo: null,
  descuento: null,
  supuestos: supuestosVacios(),
  lineas: [{ productId: "a", cantidad: 1, precioHabitual: 25, precioPromo: 20, costo: null, tasa: 18 }],
});
assert(sinCosto.combinacion.ingreso === 20 && sinCosto.combinacion.margen == null, "sin costo no hay margen");
const umbral = calcularPromo({
  tipo: "compra_minima",
  precioCombo: null,
  descuento: null,
  supuestos: { ...supuestosVacios(), ticketsElegibles: 100, yaCompraban: 10 },
  lineas: [{ productId: "a", cantidad: 1, precioHabitual: 50, precioPromo: 50, costo: 20, tasa: 18 }],
});
assert(umbral.equilibrio.tasa == null && umbral.escenarios.every((escenario) => escenario.resultado == null), "la compra mínima no inventa el equilibrio");
const descuentoMixto = calcularPromo({
  tipo: "combo",
  precioCombo: null,
  descuento: 30,
  supuestos: supuestosVacios(),
  lineas: [
    { productId: "a", cantidad: 1, precioHabitual: 100, precioPromo: null, costo: 50, tasa: 18 },
    { productId: "b", cantidad: 1, precioHabitual: 50, precioPromo: null, costo: 20, tasa: 0 },
  ],
});
assert(descuentoMixto.combinacion.margen === 45.42, `el descuento conserva la tasa de cada línea, fue ${descuentoMixto.combinacion.margen}`);
assert(revisarAritmetica({ ingreso: 118, costo: 0, tasa: 18, margen: 100 }).aritmetica === "coincide", "la estimación externa se revisa y no queda validada");
assert(revisarAritmetica({ ingreso: 118, costo: 0, tasa: 18, margen: 10 }).aritmetica === "difiere", "una estimación que no cuadra queda marcada");
assert(probabilidadCompleta({ valor: 0.8, solidez: "alta" }) == null, "ni el lift ni la solidez son una probabilidad");
assert(ordenAtencion({ estado: "por_revisar", pruebas: [{ estado: "finalizada" }] }) > ordenAtencion({ estado: "archivada", pruebas: [{ estado: "pendiente_evaluacion" }] }), "una prueba por evaluar va antes que el estado de la propuesta");
assert(indicadoresPromo([{ estado: "por_revisar", pruebas: [{ estado: "finalizada" }], evaluaciones: [] }]).evaluadas === 0, "una prueba finalizada sin evaluación no cuenta como evaluada");
