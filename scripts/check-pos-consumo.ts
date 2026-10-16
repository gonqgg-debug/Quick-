import {
  aplicarSesion,
  aplicarVentaDiaria,
  costoVigenteConsumo,
  dowOperativo,
  estadoPosVacio,
  fechaOperativaDe,
  fijarVentaManual,
  margenConsumo,
  metodoCanon,
  parsePosIngestBody,
  relojLocal,
  resolverPeriodo,
  ventaDelDia,
  ventaDifiere,
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
    subtotal: 50,
    subtotalConItbis: 59,
    odooRefundedLineId: null,
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
assert(margenConsumo(100, 4, factura.costo) === 52, "el margen usa el costo unitario");

const sucio = parsePosIngestBody({
  sesiones: [{ sesion: { odooId: 1, startAt: "2026-10-15T14:00:00Z", estado: "closed", standard_price: 10 }, ordenes: [] }],
});
assert(!sucio.ok && sucio.ok === false && sucio.status === 422, "standard_price se rechaza");

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

console.log("pos consumo ok");
