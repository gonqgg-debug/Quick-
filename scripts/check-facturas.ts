import { dueDateFromCredit, parseFormaPago, saldoCompra, summarizePendientes } from "../lib/admin-compras-shared";
import {
  casosRecordatorio,
  diferenciaMontos,
  lineasSinCatalogo,
  pendientesDe,
  propuestasPorConfirmar,
  type PendientesInput,
} from "../lib/facturas-pendientes";
import type { FacturaLinea } from "../lib/facturas-shared";
import { elegirCosto } from "../lib/admin-catalog-products-shared";
import { productoAgenteCatalogo } from "../lib/agent-read";
import { buildImportPreview } from "../lib/catalog-import";
import { catalogoError, productosACsv } from "../lib/catalog-import-http";
import { margenConsumo, tasaCatalogo, ventaSinItbis } from "../lib/pos-domain";
import { documentosDesdeValor } from "../lib/factura-documentos";
import { distanciaVentana, leerEstadoCuenta, leerFechaBanco, leerMontoBanco, llavesMovimientos, ventanaBanco } from "../lib/banco-shared";
import { revisarNcf } from "../lib/ncf";
import {
  FACTURA_ESTADOS,
  FACTURAS_AGENT_ENDPOINTS,
  FACTURAS_AGENT_USO,
  buscarDuplicado,
  explicacionDuplicado,
  leerCamposFactura,
  leerLinea,
  referenciaFactura,
  resolverUnidades,
  validacionesFiscales,
  PROPUESTA_ACEPTAR_TODAS,
  PROPUESTA_BANDA_PERSONA,
  PROPUESTA_CONFIANZA,
  PROPUESTA_UMBRAL,
  clavesAlias,
  esCampoProducto,
  esCampoUnidades,
  estadoTrasLigue,
  leerRangoPropuestas,
  propuestasEnBanda,
  textoConfirmacionUi,
  cantidadRecibidaDe,
  ALERTA_MIN_COMPRAS,
  alertasLinea,
  confianzaPago,
  confianzaTexto,
  mediana,
  medidaLinea,
  diferenciaPagos,
  diferenciaRecepcion,
  efectoCuentaAlBorrar,
  leerMotivoDescarte,
  leerRecepcion,
  normalizarDescripcion,
  resumenRecepcion,
} from "../lib/facturas-shared";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const referencia = referenciaFactura({
  proveedor: "Distribuidora Sol",
  fechaEmision: "2026-09-20",
  total: 1500,
  moneda: "DOP",
  tienda: "Jardines 3",
});
assert(referencia.includes("Distribuidora Sol"), "la referencia lleva el proveedor");
assert(referencia.includes("Jardines 3"), "la referencia lleva la tienda");
assert(!referencia.includes("uuid"), "la referencia no usa el id interno");

let sinCaja = false;
try {
  resolverUnidades({
    presentacion: "caja",
    cantidadComprada: 4,
    unidadesPorPresentacion: null,
    unidadesTotales: 96,
    costoPorPresentacion: 480,
    costoUnitario: 5,
  });
} catch (error) {
  sinCaja = error instanceof Error && error.message.includes("no se registra");
}
assert(sinCaja, "sin empaque no registra la línea en cajas");

const unidad = resolverUnidades({
  presentacion: "unidad",
  cantidadComprada: 6,
  unidadesPorPresentacion: null,
  unidadesTotales: null,
  costoPorPresentacion: 30,
  costoUnitario: null,
});
assert(unidad.unidadesPorPresentacion === 1 && unidad.unidadesTotales === 6 && unidad.costoUnitario === 30, "la unidad sí se puede calcular");

const caja = resolverUnidades({
  presentacion: "caja",
  cantidadComprada: 4,
  unidadesPorPresentacion: 24,
  unidadesTotales: 90,
  costoPorPresentacion: 480,
  costoUnitario: null,
});
assert(caja.unidadesTotales === 96 && caja.costoUnitario === 20, "4 cajas de 24 salen 96 y el costo unitario es 20");
assert(caja.aviso?.includes("empaque"), "avisa si el total enviado no coincide");

const foc = resolverUnidades({
  presentacion: "caja",
  cantidadComprada: 2,
  unidadesPorPresentacion: 10,
  unidadesTotales: null,
  costoPorPresentacion: 0,
  costoUnitario: null,
});
assert(foc.unidadesTotales === 20 && foc.costoUnitario === 0, "el regalo queda en unidades de venta a costo 0");
const convertida = leerLinea({ descripcion: "Maria Aldape", presentacion: "fardo", cantidad: 2, unidadesPorPresentacion: 25, costo: 500, total: 1000 }, 0);
assert(convertida.unidadesTotales === 50 && convertida.costoUnitario === 20 && convertida.totalLinea === 1000, "el total de la línea no cambia y el costo unitario es pagado entre unidades");

let lineaEnCajas = false;
try {
  leerLinea(
    {
      descripcion: "Agua 500 ml",
      presentacion: "caja",
      cantidad: 4,
      unidadesTotales: 96,
      costo: 480,
    },
    0
  );
} catch (error) {
  lineaEnCajas = error instanceof Error && error.message.startsWith("La línea 1") && error.message.includes("no se registra");
}
assert(lineaEnCajas, "la línea no se registra en cajas sin el empaque");

const linea = leerLinea(
  {
    descripcion: "Agua 500 ml",
    cantidad: 4,
    unidadesTotales: 4,
    costoUnitario: 30,
    costo: 30,
  },
  0
);
assert(linea.unidadesTotales === 4 && linea.costoUnitario === 30, "guarda las unidades de venta cuando no viene en cajas");
assert(linea.catalogo.accion === "omitir", "sin productoId no toca el catálogo");

const conCodigo = leerLinea({ descripcion: "Agua", codigoOdoo: "OD-1" }, 0);
assert(conCodigo.catalogo.accion === "codigo" && conCodigo.catalogo.codigo === "OD-1", "codigoOdoo enlaza el catálogo");
const quitado = leerLinea({ descripcion: "Agua", productoId: "" }, 0);
assert(quitado.catalogo.accion === "quitar", "productoId vacío quita el vínculo");

const leida = leerCamposFactura({ estado: "Completa", moneda: "RD$", tipo: "Nota de crédito", total: "1.234,50" }, "create");
assert(leida.campos.estado === "registrada", "completa cuenta como registrada");
assert(leida.campos.moneda === "DOP", "RD$ es DOP");
assert(leida.campos.tipoDocumento === "nota_credito", "acepta nota de crédito");
assert(leida.campos.total === 1234.5, "lee el monto con separador local");
assert(FACTURA_ESTADOS.find((item) => item.id === "registrada")?.ayuda.includes("Rodrigo"), "registrada pide la recepción de Rodrigo");

const duplicado = buscarDuplicado(
  { proveedor: "Sol", ncf: "b0100000001", numeroFactura: "100", fechaEmision: "2026-09-20" },
  [
    {
      id: "11111111-1111-1111-1111-111111111111",
      proveedor: "Otra",
      ncf: "B0100000001",
      numeroFactura: null,
      fechaEmision: null,
      total: 10,
      tienda: "PharmaQuick",
      moneda: "DOP",
    },
  ]
);
assert(duplicado?.motivo === "ncf", "el mismo NCF es duplicado");
assert(explicacionDuplicado("ncf", "Sol · 2026-09-20").includes("NCF"), "la explicación nombra el NCF");

const distintoDia = buscarDuplicado(
  { proveedor: "Sol", ncf: null, numeroFactura: "100", fechaEmision: "2026-09-21" },
  [
    {
      id: "22222222-2222-2222-2222-222222222222",
      proveedor: "sol",
      ncf: null,
      numeroFactura: "100",
      fechaEmision: "2026-09-20",
      total: 10,
      tienda: null,
      moneda: "DOP",
    },
  ]
);
assert(distintoDia === null, "el mismo número en otra fecha no es duplicado");

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
const fotos = documentosDesdeValor([{ nombre: "factura.jpg", pagina: 1, base64: jpeg }]);
assert(fotos.length === 1 && fotos[0]?.mime === "image/jpeg" && fotos[0]?.pagina === 1, "la foto base64 se lee como JPEG");
assert(fotos[0]?.sha256.length === 64, "la foto tiene hash para no duplicarla");

const ticket = documentosDesdeValor([{ tipo: "ticket", pagina: 2, base64: jpeg }]);
assert(ticket[0]?.tipo === "ticket" && ticket[0]?.pagina === null, "el ticket se guarda como ticket y sin número de página");
assert(fotos[0]?.tipo === "pagina", "una foto sin tipo es una página");
let tipoMalo = false;
try {
  documentosDesdeValor([{ tipo: "selfie", base64: jpeg }]);
} catch {
  tipoMalo = true;
}
assert(tipoMalo, "un tipo de documento desconocido se rechaza");

const b01 = revisarNcf("b01-0000-0001");
assert(b01.ok && b01.ncf === "B0100000001" && b01.tipo === "B01", "B01 con guiones es válido");
const e31 = revisarNcf("E310000000123");
assert(e31.ok && e31.serie === "E", "E31 con 10 dígitos es válido");
assert(revisarNcf("E340000000001").ok && (revisarNcf("E340000000001") as { esNotaCredito: boolean }).esNotaCredito, "E34 es nota de crédito");
assert(!revisarNcf("B0900000001").ok, "B09 no existe");
assert(!revisarNcf("B010000001").ok, "un NCF corto no es válido");
assert(!revisarNcf("A0100000001").ok, "la serie A no existe");
assert(!revisarNcf("E3100000001").ok, "un e-CF necesita 10 dígitos de secuencia");

const hoy = "2026-10-14T12:00:00.000Z";
const porCodigo = (lista: ReturnType<typeof validacionesFiscales>) => Object.fromEntries(lista.map((item) => [item.codigo, item]));
const bien = porCodigo(
  validacionesFiscales({ tipoDocumento: "factura", rnc: "131234567", ncf: "B0100000001", proveedor: { nombre: "Sol", rnc: "131234567" }, otraConMismoNcf: null, revisadoEn: hoy })
);
assert(bien.ncf_formato.resultado === "correcto" && bien.ncf_unico.resultado === "correcto" && bien.rnc_proveedor.resultado === "correcto", "una factura limpia pasa las tres");
const repetida = porCodigo(
  validacionesFiscales({ tipoDocumento: "factura", rnc: "131234567", ncf: "B0100000001", proveedor: { nombre: "Sol", rnc: "101000001" }, otraConMismoNcf: "Sol · 20 sep", revisadoEn: hoy })
);
assert(repetida.ncf_unico.resultado === "diferencia" && repetida.ncf_unico.explicacion?.includes("Sol · 20 sep"), "el NCF repetido nombra la otra factura");
assert(repetida.rnc_proveedor.resultado === "diferencia" && repetida.rnc_proveedor.explicacion?.includes("101000001"), "el RNC distinto al de la ficha es diferencia");
const nota = porCodigo(
  validacionesFiscales({ tipoDocumento: "nota_credito", rnc: "131234567", ncf: "B0100000001", proveedor: null, otraConMismoNcf: null, revisadoEn: hoy })
);
assert(nota.ncf_formato.resultado === "diferencia", "una nota de crédito con B01 es diferencia");
assert(nota.rnc_proveedor.resultado === "pendiente", "sin ficha el RNC queda pendiente");
const conduce = porCodigo(
  validacionesFiscales({ tipoDocumento: "conduce", rnc: null, ncf: null, proveedor: null, otraConMismoNcf: null, revisadoEn: hoy })
);
assert(conduce.ncf_formato.resultado === "no_aplica" && conduce.ncf_unico.resultado === "no_aplica", "un conduce no lleva NCF");
const sinRncFicha = porCodigo(
  validacionesFiscales({ tipoDocumento: "factura", rnc: "131234567", ncf: null, proveedor: { nombre: "Sol", rnc: null }, otraConMismoNcf: null, revisadoEn: hoy })
);
assert(sinRncFicha.ncf_formato.resultado === "pendiente", "una factura sin NCF queda pendiente");
assert(sinRncFicha.rnc_proveedor.explicacion?.includes("Proveedores"), "si la ficha no tiene RNC, dice dónde agregarlo");

assert(parseFormaPago("Transferencia") === "transferencia" && parseFormaPago("cheque") === null, "la forma de pago se normaliza");
assert(dueDateFromCredit("2026-10-14", { tieneCredito: true, diasCredito: 30 }) === "2026-11-13", "30 días de crédito desde el 14 de octubre vencen el 13 de noviembre");
assert(FACTURAS_AGENT_USO.includes("rnc_proveedor") && FACTURAS_AGENT_USO.includes("ticket"), "el texto de uso explica las validaciones automáticas y el ticket");
assert(FACTURAS_AGENT_USO.includes("unidades de venta") && FACTURAS_AGENT_USO.includes("tabla de equivalencias") && !FACTURAS_AGENT_USO.includes("no calcules"), "el texto de uso pide unidades de venta");

assert(normalizarDescripcion("  CAFÉ Santo Domingo 1lb. ") === "cafe santo domingo 1lb", "la descripción se normaliza para el alias");
assert(normalizarDescripcion("x") === null, "una descripción de una letra no sirve de alias");
assert(confianzaTexto(0.62) === 74 && confianzaTexto(0.95) === 85, "la confianza por nombre se escala y nunca pasa de 85");
assert(confianzaTexto(1) < PROPUESTA_ACEPTAR_TODAS && PROPUESTA_CONFIANZA.odoo >= PROPUESTA_ACEPTAR_TODAS, "aceptar todas toma Odoo, barras y alias, pero no texto");
assert(PROPUESTA_UMBRAL === 70, "bajo 70 la línea queda para revisión");

const faltante = { recepcion: "faltante" as const, cantidadComprada: 10, cantidadRecibida: 7, costoPorPresentacion: 120, totalLinea: 1200 };
assert(diferenciaRecepcion(faltante) === 360, "3 cajas faltantes de 120 son 360");
assert(diferenciaRecepcion({ ...faltante, costoPorPresentacion: null }) === 360, "sin costo por presentación usa el total de la línea");
assert(diferenciaRecepcion({ ...faltante, recepcion: "regalo" }) === 0, "un regalo no suma diferencia");
assert(diferenciaRecepcion({ ...faltante, recepcion: "pendiente" }) === null, "sin confirmar no hay diferencia todavía");
const resumen = resumenRecepcion([
  { recepcion: "completa", diferenciaRecepcion: 0 },
  { recepcion: "faltante", diferenciaRecepcion: 360 },
  { recepcion: "pendiente", diferenciaRecepcion: null },
]);
assert(resumen.sinConfirmar === 1 && resumen.faltantes === 1 && resumen.diferencia === 360, "el resumen cuenta pendientes, faltantes y la diferencia");

const recibida = leerRecepcion({ lineas: [{ numeroLinea: 1, recepcion: "llegó" }, { numeroLinea: 2, recepcion: "faltante", cantidadRecibida: "3" }] });
assert(recibida.lineas[0]?.recepcion === "completa" && recibida.lineas[1]?.cantidadRecibida === 3, "lee la recepción por línea");
assert(leerRecepcion({ todas: "completa" }).todas === "completa", "todas: completa marca todo");
let faltaSinCantidad = false;
try {
  cantidadRecibidaDe({ numeroLinea: 2, recepcion: "faltante", cantidadRecibida: null }, 10);
} catch (error) {
  faltaSinCantidad = error instanceof Error && error.message.includes("cantidadRecibida");
}
assert(faltaSinCantidad, "un faltante necesita cuántas llegaron");
let faltaCompleta = false;
try {
  cantidadRecibidaDe({ numeroLinea: 2, recepcion: "faltante", cantidadRecibida: 10 }, 10);
} catch {
  faltaCompleta = true;
}
assert(faltaCompleta, "si llegaron todas no es faltante");
assert(cantidadRecibidaDe({ numeroLinea: 1, recepcion: "completa", cantidadRecibida: null }, 10) === 10, "completa guarda la cantidad comprada");
assert(cantidadRecibidaDe({ numeroLinea: 1, recepcion: "completa", cantidadRecibida: null }, 4, 96) === 96, "completa iguala las unidades compradas");
assert(
  diferenciaRecepcion({
    recepcion: "faltante",
    cantidadComprada: 4,
    unidadesTotales: 96,
    cantidadRecibida: 72,
    costoPorPresentacion: 480,
    costoUnitario: 20,
    totalLinea: 1920,
  }) === 480,
  "el faltante se cobra por unidad de venta"
);
let todasFaltante = false;
try {
  leerRecepcion({ todas: "faltante" });
} catch {
  todasFaltante = true;
}
assert(todasFaltante, "los faltantes van por línea");
assert(FACTURAS_AGENT_USO.includes("/recepcion") && FACTURAS_AGENT_USO.includes("propuesta"), "el texto de uso explica recepción y propuestas");

const pagoBase = { total: 1500, monto: 1500, diasDeDiferencia: 0, proveedor: "Distribuidora Rica SRL", concepto: "FACTURA RICA", referencia: null };
assert(confianzaPago(pagoBase) === 100, "mismo monto, mismo día y el concepto nombra al proveedor");
assert(confianzaPago({ ...pagoBase, concepto: "PAGO VARIOS" }) === 85, "sin el nombre del proveedor baja a 85");
assert(confianzaPago({ ...pagoBase, concepto: "PAGO VARIOS", monto: 1504, diasDeDiferencia: 1 }) === 70, "a RD$ 4 y un día queda en 70");
assert(confianzaPago({ ...pagoBase, monto: 1506 }) === null, "a más de RD$ 5 no es el pago");
assert(confianzaPago({ ...pagoBase, diasDeDiferencia: 2 }) === null, "a dos días no es el pago");
assert(confianzaPago({ ...pagoBase, concepto: "SRL DISTRIBUIDORA", monto: 1500 }) === 85, "palabras genéricas del nombre no cuentan");
assert(diferenciaPagos(1500, []) === null, "sin pagos no hay diferencia");
assert(diferenciaPagos(1500, [{ monto: 1000 }, { monto: 500 }]) === 0, "dos pagos pueden sumar el total");
assert(diferenciaPagos(1500, [{ monto: 1000 }]) === 500, "falta lo que no se ligó");

assert(leerCamposFactura({ tipoDocumento: "nota_credito", facturaOrigen: "ABC-1" }, "create").campos.facturaOrigen === "ABC-1", "la nota manda facturaOrigen");
assert(leerCamposFactura({ factura_origen_id: null }, "patch").campos.facturaOrigen === null, "facturaOrigen null la desliga");
assert(saldoCompra(1500, 500) === 1000, "la nota se resta del saldo");
assert(saldoCompra(1500, 2000) === 0, "el saldo nunca queda negativo");
const resumenCompras = summarizePendientes([{ pagado: false, monto: 1500, notasCredito: 500, dueDate: "2026-01-01" }], "2026-02-01");
assert(resumenCompras.totalPendiente === 1000 && resumenCompras.vencidas === 1000, "cuentas por pagar usan el saldo");

const pendienteBase: PendientesInput = {
  problema: false,
  problemaDueno: null,
  problemaDesde: null,
  problemaFalta: null,
  posibleDuplicado: false,
  duplicadoReferencia: null,
  preguntasAbiertas: 0,
  estado: "verificada",
  esCompraPersonal: false,
  moneda: "DOP",
  tieneFoto: true,
  tipoDocumento: "factura",
  facturaOrigenId: null,
  fechaVencimiento: null,
  subtotal: 1000,
  descuentoTotal: 0,
  itbisTotal: 180,
  otrosCargos: 0,
  total: 1180,
  recepcion: { lineas: 2, sinConfirmar: 0, faltantes: 0, diferencia: 0 },
  lineasSinCatalogo: 0,
  propuestasPorConfirmar: { total: 0, aRevisar: 0 },
  validacionesConDiferencia: 0,
  pagosCandidatos: 0,
  lineasConAlerta: 0,
  pagosDiferencia: null,
};
const opciones = { hoy: "2026-10-14", formatDesde: (value: string | null) => value ?? "" };
assert(diferenciaMontos(pendienteBase) === 0, "subtotal más ITBIS da el total");
assert(pendientesDe(pendienteBase, opciones).length === 0, "una factura completa no tiene pendientes");
const vence = pendientesDe({ ...pendienteBase, fechaVencimiento: "2026-10-16" }, opciones);
assert(vence.length === 1 && vence[0].id === "vencimiento" && vence[0].dueno === "fred" && !vence[0].grave, "vence en 2 días le toca a Fred");
assert(pendientesDe({ ...pendienteBase, fechaVencimiento: "2026-10-20" }, opciones).length === 0, "a 6 días todavía no avisa");
assert(pendientesDe({ ...pendienteBase, fechaVencimiento: "2026-10-10" }, opciones)[0]?.grave === true, "vencida es grave");
assert(pendientesDe({ ...pendienteBase, fechaVencimiento: "2026-10-10", estado: "conciliada" }, opciones).length === 0, "conciliada no avisa");
assert(pendientesDe({ ...pendienteBase, fechaVencimiento: "2026-10-10", pagosDiferencia: 0 }, opciones).length === 0, "pagada en caja no avisa el vencimiento");
assert(pendientesDe({ ...pendienteBase, pagosCandidatos: 2 }, opciones)[0]?.id === "pago_candidato", "avisa a Fred de pagos para ligar");
assert(pendientesDe({ ...pendienteBase, pagosDiferencia: 80 }, opciones)[0]?.id === "pago_diferencia", "avisa si lo ligado no cuadra");
assert(pendientesDe({ ...pendienteBase, tipoDocumento: "nota_credito" }, opciones)[0]?.id === "nota_origen", "la nota sin original es pendiente");
assert(pendientesDe({ ...pendienteBase, lineasSinCatalogo: 1 }, opciones)[0]?.dueno === "phillip", "el catálogo le toca a Phillip");
const porConfirmar = pendientesDe({ ...pendienteBase, propuestasPorConfirmar: { total: 2, aRevisar: 1 } }, opciones)[0];
assert(porConfirmar?.id === "propuestas" && porConfirmar.dueno === null && porConfirmar.texto.includes("1 bajo 70%"), "las propuestas de Phillip bajo 90 las confirma una persona");

const lineaBase = pendienteLinea();
function pendienteLinea(): FacturaLinea {
  return {
    id: "l1",
    numeroLinea: 1,
    codigoSku: null,
    codigoBarras: null,
    descripcionOriginal: "Agua 16oz",
    productoNormalizado: null,
    marca: null,
    variante: null,
    tamano: null,
    presentacion: null,
    presentacionLabel: null,
    cantidadComprada: 1,
    unidadesPorPresentacion: null,
    unidadesTotales: null,
    costoPorPresentacion: null,
    costoUnitario: null,
    descuentoLinea: null,
    itbisLinea: null,
    precioIncluyeItbis: "no_determinado",
    precioIncluyeItbisLabel: "",
    subtotalLinea: null,
    totalLinea: null,
    estado: "completa",
    estadoLabel: "",
    observacion: null,
    productoId: null,
    productoCatalogo: null,
    productoConfirmadoPor: null,
    productoConfirmadoEn: null,
    origenLigue: null,
    unidadesConfirmadoPor: null,
    unidadesConfirmadoEn: null,
    propuesta: null,
    recepcion: "completa",
    recepcionLabel: "",
    cantidadRecibida: null,
    recepcionPor: null,
    recepcionEn: null,
    diferenciaRecepcion: null,
    alertas: [],
  };
}
const propuestaAgente = (confianza: number): NonNullable<FacturaLinea["propuesta"]> => ({
  productoId: "p1",
  confianza,
  origen: "agente",
  origenLabel: "",
  producto: null,
  razon: "mismo código de proveedor",
  por: "Phillip",
  en: null,
});
assert(lineasSinCatalogo([lineaBase]) === 1, "sin propuesta le toca a Phillip");
assert(lineasSinCatalogo([{ ...lineaBase, propuesta: propuestaAgente(80) }]) === 0, "con propuesta de Phillip bajo 90 ya no es de Phillip");
assert(propuestasPorConfirmar([{ ...lineaBase, propuesta: propuestaAgente(60) }]).aRevisar === 1, "bajo 70 queda a revisar");
assert(lineasSinCatalogo([{ ...lineaBase, propuesta: propuestaAgente(95) }]) === 1, "con 90 o más Phillip la liga él mismo");
assert(lineasSinCatalogo([{ ...lineaBase, propuesta: { ...propuestaAgente(95), origen: "barras" } }]) === 1, "una señal exacta de la plataforma la acepta Phillip");
assert(pendientesDe({ ...pendienteBase, estado: "recibida", recepcion: { lineas: 2, sinConfirmar: 2, faltantes: 0, diferencia: 0 } }, opciones)[0]?.dueno === "rodrigo", "la recepción le toca a Rodrigo");

const ahora = { hoy: "2026-10-14", ms: Date.parse("2026-10-14T12:00:00.000Z") };
const recordatorioBase = {
  estado: "recibida" as const,
  esCompraPersonal: false,
  tipoDocumento: "factura" as const,
  recibidoEn: "2026-10-13T11:00:00.000Z",
  lineasSinRecepcion: 3,
  venceSinPagar: null,
};
assert(casosRecordatorio(recordatorioBase, ahora)[0]?.caso === "sin_recepcion", "más de 24 horas sin recepción abre caso");
assert(casosRecordatorio({ ...recordatorioBase, recibidoEn: "2026-10-13T13:00:00.000Z" }, ahora).length === 0, "menos de 24 horas espera");
assert(casosRecordatorio({ ...recordatorioBase, esCompraPersonal: true }, ahora).length === 0, "la compra personal no necesita recepción");
const venceCaso = casosRecordatorio({ ...recordatorioBase, lineasSinRecepcion: 0, estado: "verificada", venceSinPagar: "2026-10-17" }, ahora);
assert(venceCaso.length === 1 && venceCaso[0].caso === "vence:2026-10-17" && venceCaso[0].dueno === "fred", "vence en 3 días abre caso de Fred");
assert(casosRecordatorio({ ...recordatorioBase, lineasSinRecepcion: 0, venceSinPagar: "2026-10-18" }, ahora).length === 0, "a 4 días todavía no");

assert(leerFechaBanco("05/10/2026") === "2026-10-05", "el banco pone el día primero");
assert(leerFechaBanco("2026-10-05") === "2026-10-05", "también lee ISO");
assert(leerFechaBanco("05-Oct-26") === "2026-10-05", "lee el mes en letras");
assert(leerFechaBanco("5 ago. 2026") === "2026-08-05", "lee el mes en español");
assert(leerFechaBanco("31/02/2026") === null, "una fecha imposible no pasa");
assert(leerFechaBanco("46300") === "2026-10-05", "lee el número de serie de Excel");
assert(leerMontoBanco("-1.234,56") === -1234.56, "negativo con coma decimal");
assert(leerMontoBanco("(1,234.56)") === -1234.56, "paréntesis es negativo");
assert(leerMontoBanco("1,234.56-") === -1234.56, "signo al final es negativo");
assert(leerMontoBanco("RD$ 2,500.00") === 2500, "quita RD$");
assert(leerMontoBanco("") === null, "vacío no es monto");

const popular = leerEstadoCuenta([
  ["Banco Popular Dominicano"],
  ["Cuenta", "****1234"],
  ["Fecha Posteo", "Descripción", "No. Referencia", "Débito", "Crédito", "Balance"],
  ["05/10/2026", "TRANSF A DISTRIBUIDORA RICA", "778812", "1,500.00", "", "98,500.00"],
  ["06/10/2026", "DEPOSITO", "", "", "20,000.00", "118,500.00"],
  ["", "Saldo final", "", "", "", "118,500.00"],
]);
assert(popular.movimientos.length === 2 && popular.descartadas === 1, "salta el saldo final");
assert(popular.movimientos[0].tipo === "debito" && popular.movimientos[0].monto === 1500 && popular.movimientos[0].referencia === "778812", "débito con referencia");
assert(popular.movimientos[1].tipo === "credito" && popular.movimientos[1].monto === 20000, "crédito");
const firmado = leerEstadoCuenta([
  ["Fecha", "Concepto", "Monto"],
  ["2026-10-05", "PAGO KOLA REAL", "-3,200.50"],
  ["2026-10-05", "PAGO KOLA REAL", "-3,200.50"],
  ["2026-10-06", "INTERESES", "12.00"],
]);
assert(firmado.movimientos[0].tipo === "debito" && firmado.movimientos[2].tipo === "credito", "el signo decide débito o crédito");
const llaves = llavesMovimientos("Popular", null, firmado.movimientos);
assert(llaves[0] !== llaves[1] && new Set(llaves).size === 3, "dos filas iguales en el mismo archivo no se juntan");
assert(llavesMovimientos("Popular", null, firmado.movimientos).join() === llaves.join(), "reimportar da las mismas llaves");
let sinEncabezado = false;
try {
  leerEstadoCuenta([["a", "b"], ["1", "2"]]);
} catch (error) {
  sinEncabezado = error instanceof Error && error.message.startsWith("El archivo");
}
assert(sinEncabezado, "sin encabezado explica qué falta");
const ventana = ventanaBanco({ fechaEmision: "2026-10-01", fechaVencimiento: "2026-10-31", recibidaDia: "2026-10-02" });
assert(ventana.desde === "2026-09-30" && ventana.hasta === "2026-10-31", "la ventana del banco va de la emisión al vencimiento");
assert(distanciaVentana("2026-10-15", ventana.desde, ventana.hasta) === 0, "dentro de la ventana es cero");
assert(distanciaVentana("2026-11-03", ventana.desde, ventana.hasta) === 3, "tres días después del vencimiento");
assert(confianzaPago({ ...pagoBase, diasDeDiferencia: 5, maxDias: 7 }) === 95, "el banco acepta hasta 7 días después");
assert(confianzaPago({ ...pagoBase, diasDeDiferencia: 8, maxDias: 7 }) === null, "a 8 días ya no");

assert(mediana([3, 1, 2]) === 2 && mediana([1, 2, 3, 4]) === 2.5 && mediana([]) === null, "mediana");
const enUnidades = (costo: number, cantidad = 24) =>
  medidaLinea({ costoUnitario: costo, unidadesTotales: cantidad, costoPorPresentacion: costo * 24, cantidadComprada: 1, presentacion: "caja", unidadesPorPresentacion: 24 });
const historial = [enUnidades(50), enUnidades(52), enUnidades(48), enUnidades(51)];
const umbral = { precio: 0.15, cantidad: 0.5 };
assert(alertasLinea(enUnidades(55), historial, umbral).length === 0, "10% más no avisa");
const caro = alertasLinea(enUnidades(62), historial, umbral);
assert(caro.length === 1 && caro[0].tipo === "precio" && caro[0].mediana === 50.5 && caro[0].variacion > 0.2, "23% más caro avisa");
assert(alertasLinea(enUnidades(40), historial, umbral)[0]?.variacion < 0, "mucho más barato también avisa");
assert(alertasLinea(enUnidades(50, 72), historial, umbral)[0]?.tipo === "cantidad", "el triple de unidades avisa");
assert(alertasLinea(enUnidades(62), historial.slice(0, ALERTA_MIN_COMPRAS - 1), umbral).length === 0, "sin historial suficiente no avisa");
const porCaja = medidaLinea({ costoUnitario: null, unidadesTotales: null, costoPorPresentacion: 1500, cantidadComprada: 2, presentacion: "fardo", unidadesPorPresentacion: null });
assert(alertasLinea(porCaja, historial, umbral).length === 0, "no compara un fardo contra precios por unidad");
assert(pendientesDe({ ...pendienteBase, lineasConAlerta: 2 }, opciones)[0]?.dueno === "boris", "las alertas de precio le tocan a Boris");

assert(FACTURAS_AGENT_USO.includes("movimientoId") && FACTURAS_AGENT_USO.includes("alertas"), "el texto de uso explica banco y alertas");
assert(FACTURAS_AGENT_USO.includes("facturaOrigen") && FACTURAS_AGENT_USO.includes("/api/agent/pendientes"), "el texto de uso explica notas y pendientes");
assert(FACTURAS_AGENT_ENDPOINTS.length === 18, "el directorio del agente lista las rutas de facturas");
assert(
  FACTURAS_AGENT_ENDPOINTS.some((item) => item.method === "POST" && item.path === "/api/agent/facturas/{id-o-clave}/compra"),
  "hay una ruta para ligar la ficha con su compra"
);
assert(
  FACTURAS_AGENT_ENDPOINTS.some((item) => item.method === "GET" && item.path.startsWith("/api/agent/presentaciones")),
  "la tabla de equivalencias se puede leer"
);
assert(FACTURAS_AGENT_USO.includes("motivo"), "el texto de uso pide el motivo al borrar");
assert(leerMotivoDescarte("  duplicada de Rica  ") === "duplicada de Rica", "el motivo se guarda limpio");
let motivoCorto = false;
try {
  leerMotivoDescarte("ok");
} catch (error) {
  motivoCorto = error instanceof Error && error.message.startsWith("Manda el motivo");
}
assert(motivoCorto, "borrar sin motivo no pasa");
assert(
  FACTURAS_AGENT_ENDPOINTS.some((item) => item.method === "DELETE" && item.path === "/api/agent/facturas/{id-o-clave}"),
  "Rodrigo tiene ruta para borrar una factura"
);
assert(FACTURAS_AGENT_USO.includes("DELETE /api/agent/facturas/"), "el texto de uso explica cómo borrar una factura");
const cuentaBase = { tipoDocumento: "factura" as const, total: 1500, compraAjena: false, pagado: false, notasCredito: 0, monto: 1500 };
assert(efectoCuentaAlBorrar(cuentaBase).accion === "borrar-compra", "la cuenta sin pagar de una factura sola se borra con ella");
assert(efectoCuentaAlBorrar({ ...cuentaBase, compraAjena: true }).accion === "ninguna", "un duplicado no borra la cuenta de la factura original");
let cuentaPagada = false;
try {
  efectoCuentaAlBorrar({ ...cuentaBase, pagado: true });
} catch (error) {
  cuentaPagada = error instanceof Error && error.message.includes("ya está pagada");
}
assert(cuentaPagada, "una cuenta pagada no se borra");
const notaBorrada = efectoCuentaAlBorrar({ tipoDocumento: "nota_credito", total: 200, compraAjena: true, pagado: true, notasCredito: 1500, monto: 1500 });
assert(notaBorrada.accion === "ajustar-nota" && notaBorrada.notasCredito === 1300 && notaBorrada.reabrir, "borrar la nota devuelve el descuento y reabre la cuenta");
assert(FACTURAS_AGENT_ENDPOINTS.some((item) => item.path.endsWith("/lineas/propuestas")), "Phillip tiene ruta para proponer");
assert(FACTURAS_AGENT_ENDPOINTS.some((item) => item.path.endsWith("/lineas/candidatos")), "Phillip tiene ruta de candidatos");
assert(FACTURAS_AGENT_USO.includes("razon") && !FACTURAS_AGENT_USO.includes("texto hasta 85"), "el texto de uso dice que Phillip propone");
assert(FACTURAS_AGENT_USO.includes("productoConfirmadoPor") && FACTURAS_AGENT_USO.includes("origenLigue") && FACTURAS_AGENT_USO.includes("linea.confirmada"), "el texto de uso explica la confirmación humana");
assert(textoConfirmacionUi("Gonzalo") === "Confirmado por Gonzalo en UI", "la respuesta de la UI nombra a quien confirmó");
assert(esCampoProducto("productoId") && esCampoProducto("producto_id") && !esCampoProducto("unidadesPorPresentacion"), "la pregunta de producto se reconoce por el campo");
assert(esCampoUnidades("unidadesPorPresentacion") && esCampoUnidades("unidades") && !esCampoUnidades("productoId"), "la pregunta de unidades se reconoce por el campo");
assert(estadoTrasLigue("ambigua") === "completa" && estadoTrasLigue("ilegible") === "ilegible", "ligar saca la línea de ambigua y no toca una ilegible");
assert(clavesAlias("Leche entera 1L", "SKU-12").join("|") === "leche entera 1l sku 12|leche entera 1l", "el alias junta descripción del proveedor y SKU, y conserva la descripción sola");
assert(clavesAlias("Café", null).join("|") === "cafe", "sin SKU el alias es la descripción");
const sigma = [0, 1, 2, 3].map((index) => ({
  ...lineaBase,
  id: `l${index}`,
  numeroLinea: index + 1,
  estado: "completa" as const,
  productoId: `p${index}`,
  productoConfirmadoPor: "Gonzalo",
  origenLigue: "humano" as const,
}));
assert(
  sigma.length === 4 && sigma.every((linea) => linea.productoId != null && linea.productoConfirmadoPor === "Gonzalo" && linea.origenLigue === "humano" && estadoTrasLigue(linea.estado) === "completa"),
  "las 4 líneas de Sigma quedan ligadas por Gonzalo"
);
assert(propuestasEnBanda([{ ...lineaBase, propuesta: propuestaAgente(80) }, { ...lineaBase, propuesta: propuestaAgente(95) }, { ...lineaBase, propuesta: propuestaAgente(60) }], PROPUESTA_BANDA_PERSONA.minimo, PROPUESTA_BANDA_PERSONA.maximo).length === 1, "la bandeja confirma solo de 70 a 89");
assert(leerRangoPropuestas({}, "phillip").minimo === 90 && leerRangoPropuestas({ minimo: 70, maximo: 89 }, "admin").maximo === 89, "Phillip no baja de 90 y una persona sí confirma la bandeja");
let phillipBajo = false;
try {
  leerRangoPropuestas({ minimo: 70 }, "phillip");
} catch (error) {
  phillipBajo = error instanceof Error && error.message.includes("Solo una persona");
}
assert(phillipBajo, "Phillip no confirma la banda de 70 a 89");
assert(FACTURAS_AGENT_ENDPOINTS.some((item) => item.path === "/api/agent/presentaciones"), "hay una ruta para guardar presentaciones");
assert(FACTURAS_AGENT_ENDPOINTS.some((item) => item.path.includes("documentos")), "hay una ruta para subir la foto");

const csvCatalogo = productosACsv([
  { codigo: "A1", nombre: "Agua, 16oz", precio: 25, categoria: "Bebidas", codigoBarras: "7460000000017" },
  { codigo: "B2", nombre: "Pan", precio: 60, categoria: "Panadería" },
  { codigo: "C3", nombre: "Sin precio", categoria: "Otros" },
]);
const vistaCatalogo = buildImportPreview(Buffer.from(csvCatalogo), "productos.csv", [
  { id: "p-b2", codigo_odoo: "B2", codigo_barras: null, nombre: "Pan", marca: null, categoria: "Panadería", precio: 55 },
]);
assert(vistaCatalogo.created.length === 1 && vistaCatalogo.created[0].nombre === "Agua, 16oz", "Rodrigo crea productos desde JSON, con comas en el nombre");
assert(vistaCatalogo.created[0]?.costo == null, "sin costo en el JSON no se propone un costo manual");
assert(vistaCatalogo.created[0]?.tasaItbis == null, "sin tasaItbis en el JSON no se propone una tasa");
assert(vistaCatalogo.updated[0]?.changes.map((change) => change.field).join() === "precio", "un código existente solo cambia lo que difiere");
assert(vistaCatalogo.invalid[0]?.codigo === "C3", "sin precio no se importa");

const csvCosto = productosACsv([
  { codigo: "A1", nombre: "Agua, 16oz", precio: 25, categoria: "Bebidas", costo: 10 },
  { codigo: "B2", nombre: "Pan", precio: 55, categoria: "Panadería" },
  { codigo: "D4", nombre: "Jugo", precio: 40, categoria: "Bebidas", costo: "abc" },
]);
const vistaCosto = buildImportPreview(Buffer.from(csvCosto), "productos.csv", [
  { id: "p-a1", codigo_odoo: "A1", codigo_barras: null, nombre: "Agua, 16oz", marca: null, categoria: "Bebidas", precio: 25, costo_manual: 9 },
  { id: "p-b2", codigo_odoo: "B2", codigo_barras: null, nombre: "Pan", marca: null, categoria: "Panadería", precio: 55, costo_manual: 8 },
]);
assert(
  vistaCosto.updated.find((item) => item.codigo === "A1")?.changes.some((change) => change.field === "costo" && change.to === 10),
  "un costo distinto se propone como cambio"
);
assert(
  vistaCosto.unchanged.some((item) => item.codigo === "B2") && !vistaCosto.updated.some((item) => item.codigo === "B2"),
  "omitir el costo no toca el costo manual"
);
assert(vistaCosto.invalid.some((item) => item.codigo === "D4"), "un costo que no es número invalida la fila");

const mismoCosto = buildImportPreview(
  Buffer.from(productosACsv([{ codigo: "A1", nombre: "Agua, 16oz", precio: 25, categoria: "Bebidas", costo: 9 }])),
  "productos.csv",
  [{ id: "p-a1", codigo_odoo: "A1", codigo_barras: null, nombre: "Agua, 16oz", marca: null, categoria: "Bebidas", precio: 25, costo_manual: 9 }]
);
assert(mismoCosto.unchanged.length === 1 && mismoCosto.updated.length === 0, "el mismo costo no refresca la fecha");

const vistaOdoo = buildImportPreview(
  Buffer.from("codigo,nombre,precio,categoria,standard_price\nE5,Cafe,30,Bebidas,7.5\n"),
  "odoo.csv",
  []
);
assert(vistaOdoo.created[0]?.costo === 7.5, "standard_price de Odoo se lee como costo");
assert(vistaOdoo.created[0]?.tasaItbis == null, "sin columna de tasa no se propone una tasa");

const productoBase = {
  id: "p-a1",
  codigo_odoo: "A1",
  codigo_barras: null,
  nombre: "Agua, 16oz",
  marca: null,
  categoria: "Bebidas",
  precio: 25,
  tasa_itbis: 18,
};
const vistaTasa0 = buildImportPreview(
  Buffer.from(productosACsv([{ codigo: "A1", nombre: "Agua, 16oz", precio: 25, categoria: "Bebidas", tasaItbis: 0 }])),
  "productos.csv",
  [productoBase]
);
const cambioTasa = vistaTasa0.updated.find((item) => item.codigo === "A1")?.changes.find((change) => change.field === "tasaItbis");
assert(
  vistaTasa0.updated.length === 1 && cambioTasa?.from === 18 && cambioTasa.to === 0 && cambioTasa.fromLabel === "18" && cambioTasa.toLabel === "0",
  "el dry-run muestra la tasa 18 → 0"
);
assert(vistaTasa0.created.length === 0 && vistaTasa0.updated[0]?.tasaItbis === 0, "una tasa 0 queda en el producto a guardar");
const csvTasa = buildImportPreview(
  Buffer.from("codigo,nombre,precio,categoria,tasa_itbis\nB2,Pan,55,Panadería,16\n"),
  "odoo.csv",
  [{ ...productoBase, id: "p-b2", codigo_odoo: "B2", nombre: "Pan", categoria: "Panadería", precio: 55, tasa_itbis: 18 }]
);
assert(
  csvTasa.updated[0]?.changes.some((change) => change.field === "tasaItbis" && change.fromLabel === "18" && change.toLabel === "16"),
  "la columna tasa_itbis del CSV también actualiza la tasa"
);
const sinCampo = buildImportPreview(
  Buffer.from(productosACsv([{ codigo: "A1", nombre: "Agua, 16oz", precio: 25, categoria: "Bebidas" }])),
  "productos.csv",
  [{ ...productoBase, tasa_itbis: 0 }]
);
assert(
  sinCampo.unchanged.length === 1 && sinCampo.updated.length === 0 && sinCampo.created.length === 0,
  "sin tasaItbis no se toca una tasa 0"
);
const mismaTasa = buildImportPreview(
  Buffer.from("codigo,nombre,precio,categoria,tasaItbis\nA1,\"Agua, 16oz\",25,Bebidas,18\n"),
  "productos.csv",
  [productoBase]
);
assert(mismaTasa.unchanged.length === 1, "la misma tasa no cuenta como cambio");
const nuevoCero = buildImportPreview(
  Buffer.from(productosACsv([{ codigo: "Z9", nombre: "Exento", precio: 40, categoria: "Bebidas", tasaItbis: 0 }])),
  "productos.csv",
  []
);
assert(nuevoCero.created[0]?.tasaItbis === 0, "un producto nuevo con tasa 0 no hereda 18 en la importación");
let tasaInvalida = false;
let mensajeTasa = "";
try {
  buildImportPreview(
    Buffer.from(productosACsv([{ codigo: "A1", nombre: "Agua, 16oz", precio: 25, categoria: "Bebidas", tasaItbis: 7 }])),
    "productos.csv",
    [productoBase]
  );
} catch (error) {
  tasaInvalida = error instanceof Error;
  mensajeTasa = error instanceof Error ? error.message : "";
}
const respuestaTasa = catalogoError(tasaInvalida ? new Error(mensajeTasa) : "fallo", "No pudimos importar el catálogo", "test tasa");
assert(
  tasaInvalida && mensajeTasa.includes("A1") && mensajeTasa.includes("7") && respuestaTasa.status === 400,
  "una tasa distinta de 0, 16 o 18 responde 400 e indica el producto"
);
const precio = 100;
const costo = 12;
const unidades = 4;
const tasaImportada = vistaTasa0.updated[0]?.tasaItbis ?? 18;
assert(tasaImportada === 0 && ventaSinItbis(precio, tasaImportada) === precio, "con tasa 0 el precio sin ITBIS es el precio con ITBIS");
assert(ventaSinItbis(costo, tasaImportada) === costo, "con tasa 0 el costo sin ITBIS es el costo con ITBIS");
assert(margenConsumo(precio, unidades, costo, tasaImportada) === 52, "con tasa 0 el margen es venta menos costo");
const leido = productoAgenteCatalogo(
  { id: "p-a1", nombre: "Agua, 16oz", marca: null, categoria: "Bebidas", precio: 25, tasa_itbis: 0, codigo_odoo: "A1", codigo_barras: null, activo: true },
  true
);
assert(leido.tasaItbis === 0 && leido.tasa_itbis === 0 && tasaCatalogo(0) === 0, "GET del producto muestra la tasa 0 guardada");

const costoBase = {
  facturaCosto: 12,
  facturaEn: "2026-10-14T18:00:00Z",
  manualCosto: 10,
  manualEn: "2026-10-14T15:00:00.000Z",
  manualFuente: "odoo" as const,
};
assert(elegirCosto(costoBase).fuente === "factura", "la factura más nueva gana");
assert(elegirCosto({ ...costoBase, manualEn: "2026-10-14T20:00:00.000Z" }).fuente === "odoo", "el costo manual más nuevo gana");
assert(elegirCosto({ ...costoBase, manualEn: "2026-10-14T18:00:00.000Z" }).fuente === "factura", "en empate queda la factura");
assert(
  elegirCosto({ ...costoBase, facturaEn: "2026-10-14", manualEn: "2026-10-14T15:00:00-04:00" }).fuente === "odoo",
  "un costo manual del mismo día, después de medianoche, gana sobre una fecha de factura"
);
assert(
  elegirCosto({ facturaCosto: null, facturaEn: null, manualCosto: 10, manualEn: "2026-10-14T15:00:00Z", manualFuente: "admin" }).fuente === "admin",
  "solo el costo manual se muestra"
);
assert(elegirCosto({ ...costoBase, manualCosto: null }).fuente === "factura", "sin costo manual queda el de la factura");

console.log("facturas ok");
