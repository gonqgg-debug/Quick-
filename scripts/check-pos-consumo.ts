import {
  aplicarSesion,
  aplicarVentaDiaria,
  costoVigenteConsumo,
  dowOperativo,
  estadoPosVacio,
  fechaOperativaDe,
  fijarVentaManual,
  itbisIncluido,
  margenConsumo,
  metodoCanon,
  parsePosIngestBody,
  relojLocal,
  resolverPeriodo,
  tasaCatalogo,
  ventaDelDia,
  ventaDifiere,
  ventaSinItbis,
  type PosNormalizado,
} from "../lib/pos-domain";

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
assert(ventaSinItbis(118) === 100, "118 cobrados con ITBIS incluido tienen base 100");
assert(itbisIncluido(118) === 18, "el ITBIS incluido en 118 es 18");
assert(margenConsumo(100, 4, factura.costo) === 36.75, "el margen saca el ITBIS de 18 antes de restar el costo de 48");
assert(margenConsumo(100, 4, 12, 0) === 52, "con ITBIS 0 el margen es venta menos costo");
assert(margenConsumo(116, 1, 100, 16) === 0, "con ITBIS 16, 116 cobrados tienen base 100");
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
