import { dueDateFromCredit, parseFormaPago } from "../lib/admin-compras-shared";
import { documentosDesdeValor } from "../lib/factura-documentos";
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
  PROPUESTA_CONFIANZA,
  PROPUESTA_UMBRAL,
  cantidadRecibidaDe,
  confianzaTexto,
  diferenciaRecepcion,
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

const sinCaja = resolverUnidades({
  presentacion: "caja",
  cantidadComprada: 4,
  unidadesPorPresentacion: null,
  unidadesTotales: 96,
  costoPorPresentacion: 480,
  costoUnitario: 5,
});
assert(sinCaja.unidadesTotales === null && sinCaja.costoUnitario === null, "no calcula unidades si no conoce la caja");
assert(sinCaja.aviso?.includes("no está confirmado"), "avisa que ignoró el cálculo");

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
assert(caja.aviso?.includes("recalcularon"), "avisa si el total enviado no coincide");

const linea = leerLinea(
  {
    descripcion: "Agua 500 ml",
    presentacion: "caja",
    cantidad: 4,
    unidadesTotales: 96,
    costo: 480,
  },
  0
);
assert(linea.unidadesTotales === null && linea.costoUnitario === null, "la línea no guarda unidades dudosas");
assert(linea.observacion?.includes("no está confirmado"), "la observación explica por qué");
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
let todasFaltante = false;
try {
  leerRecepcion({ todas: "faltante" });
} catch {
  todasFaltante = true;
}
assert(todasFaltante, "los faltantes van por línea");
assert(FACTURAS_AGENT_USO.includes("/recepcion") && FACTURAS_AGENT_USO.includes("propuesta"), "el texto de uso explica recepción y propuestas");

assert(FACTURAS_AGENT_ENDPOINTS.length === 13, "el directorio del agente lista las rutas de facturas");
assert(FACTURAS_AGENT_ENDPOINTS.some((item) => item.path === "/api/agent/presentaciones"), "hay una ruta para guardar presentaciones");
assert(FACTURAS_AGENT_ENDPOINTS.some((item) => item.path.includes("documentos")), "hay una ruta para subir la foto");

console.log("facturas ok");
