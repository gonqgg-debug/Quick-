import { documentosDesdeValor } from "../lib/contabilidad/factura-documentos";
import {
  FACTURA_ESTADOS,
  FACTURAS_AGENT_ENDPOINTS,
  buscarDuplicado,
  explicacionDuplicado,
  leerCamposFactura,
  leerLinea,
  referenciaFactura,
  resolverUnidades,
} from "../lib/contabilidad/facturas-shared";

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
assert(leida.campos.estado === "completa", "acepta la etiqueta del estado");
assert(leida.campos.moneda === "DOP", "RD$ es DOP");
assert(leida.campos.tipoDocumento === "nota_credito", "acepta nota de crédito");
assert(leida.campos.total === 1234.5, "lee el monto con separador local");
assert(FACTURA_ESTADOS.find((item) => item.id === "completa")?.ayuda.includes("Odoo"), "completa no significa Odoo");

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

assert(FACTURAS_AGENT_ENDPOINTS.length === 10, "el directorio del agente lista las rutas de facturas");
assert(FACTURAS_AGENT_ENDPOINTS.some((item) => item.path.includes("documentos")), "hay una ruta para subir la foto");

console.log("facturas ok");
