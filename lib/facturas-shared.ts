import { calendarDayKey } from "@/lib/local-day";
import { revisarNcf } from "@/lib/ncf";

export const FACTURA_ESTADOS = [
  { id: "falta_factura", label: "Falta factura", corto: "Falta factura", ayuda: "Hay una salida de caja y todavía no llegó el comprobante." },
  { id: "recibida", label: "Recibida", corto: "Recibida", ayuda: "Llegó la foto y Phillip todavía no cierra los renglones." },
  { id: "registrada", label: "Registrada", corto: "Registrada", ayuda: "Phillip terminó los renglones y Rodrigo confirmó qué llegó de cada uno." },
  { id: "verificada", label: "Verificada", corto: "Verificada", ayuda: "Boris cuadró RNC, NCF y montos contra el sistema, la caja y la DGII." },
  { id: "conciliada", label: "Conciliada", corto: "Conciliada", ayuda: "Fred encontró el pago en banco, caja o CardNET." },
] as const;

export const FACTURA_TIPOS = [
  { id: "factura", label: "Factura" },
  { id: "nota_credito", label: "Nota de crédito" },
  { id: "conduce", label: "Conduce" },
  { id: "recibo", label: "Recibo" },
  { id: "cotizacion", label: "Cotización" },
] as const;

export const FACTURA_CONDICIONES = [
  { id: "contado", label: "Contado" },
  { id: "credito", label: "Crédito" },
] as const;

export const FACTURA_MONEDAS = [
  { id: "DOP", label: "RD$" },
  { id: "USD", label: "US$" },
  { id: "EUR", label: "EUR" },
] as const;

export const FACTURA_PRESENTACIONES = [
  { id: "unidad", label: "Unidad" },
  { id: "paquete", label: "Paquete" },
  { id: "caja", label: "Caja" },
  { id: "fardo", label: "Fardo" },
  { id: "otro", label: "Otra" },
] as const;

export const FACTURA_ESTADOS_LINEA = [
  { id: "completa", label: "Completa" },
  { id: "ambigua", label: "Ambigua" },
  { id: "ilegible", label: "Ilegible" },
  { id: "pendiente", label: "Pendiente" },
] as const;

export const FACTURA_ITBIS_LINEA = [
  { id: "si", label: "Sí" },
  { id: "no", label: "No" },
  { id: "no_determinado", label: "No determinado" },
] as const;

export const FACTURA_VALIDACIONES = [
  { id: "suma_lineas", label: "Suma de líneas coincide con subtotal" },
  { id: "itbis", label: "ITBIS recalculado coincide" },
  { id: "total", label: "Total recalculado coincide" },
  { id: "ncf_legible", label: "NCF legible" },
  { id: "numero_legible", label: "Número de factura legible" },
  { id: "posible_duplicado", label: "Posible factura duplicada" },
  { id: "paginas", label: "Todas las páginas recibidas" },
  { id: "cantidades", label: "Cantidades y presentaciones claras" },
  { id: "diferencia_matematica", label: "Diferencia matemática detectada" },
  { id: "documento_completo", label: "Documento completo o incompleto" },
  { id: "ncf_formato", label: "Formato del NCF" },
  { id: "ncf_unico", label: "NCF no repetido para ese RNC" },
  { id: "rnc_proveedor", label: "RNC coincide con el proveedor" },
] as const;

/** Las calcula la plataforma al guardar la factura. Lo que mande un bot con estos códigos se reemplaza. */
export const FACTURA_VALIDACIONES_AUTOMATICAS = ["ncf_formato", "ncf_unico", "rnc_proveedor"] as const;

export const FACTURA_DOCUMENTO_TIPOS = [
  { id: "pagina", label: "Página" },
  { id: "ticket", label: "Ticket" },
] as const;

export const FACTURA_RESULTADOS = [
  { id: "correcto", label: "Correcto" },
  { id: "diferencia", label: "Diferencia" },
  { id: "pendiente", label: "Pendiente" },
  { id: "no_aplica", label: "No aplica" },
] as const;

export const FACTURA_RECEPCIONES = [
  { id: "pendiente", label: "Sin confirmar" },
  { id: "completa", label: "Completa" },
  { id: "faltante", label: "Faltante" },
  { id: "regalo", label: "Regalo" },
] as const;

export const FACTURA_PROPUESTA_ORIGENES = [
  { id: "alias", label: "Confirmado antes con este proveedor" },
  { id: "barras", label: "Código de barras" },
  { id: "odoo", label: "Código de Odoo" },
  { id: "texto", label: "Nombre parecido" },
  { id: "agente", label: "Propuesta de Phillip" },
] as const;

/** Bajo este porcentaje la propuesta se muestra, pero la línea queda para revisión. */
export const PROPUESTA_UMBRAL = 70;
/** «Aceptar todas» solo toma propuestas desde este porcentaje. */
export const PROPUESTA_ACEPTAR_TODAS = 90;
/** Una persona puede confirmar en lote las propuestas de esta banda. Phillip no. */
export const PROPUESTA_BANDA_PERSONA = { minimo: PROPUESTA_UMBRAL, maximo: PROPUESTA_ACEPTAR_TODAS - 1 } as const;
export const PROPUESTA_CONFIANZA = { alias: 100, barras: 95, odoo: 90 } as const;
/** Cuántos productos por nombre parecido se le dan a Phillip por línea. */
export const CANDIDATOS_POR_LINEA = 5;

export const FACTURA_PREGUNTA_ESTADOS = [
  { id: "abierta", label: "Abierta" },
  { id: "resuelta", label: "Resuelta" },
] as const;

export type FacturaEstado = (typeof FACTURA_ESTADOS)[number]["id"];
export type FacturaTipoDocumento = (typeof FACTURA_TIPOS)[number]["id"];
export type FacturaCondicion = (typeof FACTURA_CONDICIONES)[number]["id"];
export type FacturaMoneda = (typeof FACTURA_MONEDAS)[number]["id"];
export type FacturaPresentacion = (typeof FACTURA_PRESENTACIONES)[number]["id"];
export type FacturaEstadoLinea = (typeof FACTURA_ESTADOS_LINEA)[number]["id"];
export type FacturaItbisLinea = (typeof FACTURA_ITBIS_LINEA)[number]["id"];
export type FacturaValidacionCodigo = (typeof FACTURA_VALIDACIONES)[number]["id"];
export type FacturaResultado = (typeof FACTURA_RESULTADOS)[number]["id"];
export type FacturaPreguntaEstado = (typeof FACTURA_PREGUNTA_ESTADOS)[number]["id"];
export type FacturaDocumentoTipo = (typeof FACTURA_DOCUMENTO_TIPOS)[number]["id"];
export type FacturaRecepcion = (typeof FACTURA_RECEPCIONES)[number]["id"];
export type FacturaPropuestaOrigen = (typeof FACTURA_PROPUESTA_ORIGENES)[number]["id"];

export const ORIGENES_LIGUE = [
  { id: "humano", label: "Confirmado por una persona" },
  { id: "propuesta_auto", label: "Propuesta aceptada sola" },
  { id: "alias", label: "Alias del proveedor" },
] as const;

export type OrigenLigue = (typeof ORIGENES_LIGUE)[number]["id"];

export type FacturaPropuesta = {
  productoId: string;
  confianza: number;
  origen: FacturaPropuestaOrigen;
  origenLabel: string;
  producto: FacturaProductoCatalogo | null;
  /** Solo en las propuestas del agente. */
  razon: string | null;
  por: string | null;
  en: string | null;
};

export type FacturaCandidatoSenal = "alias" | "barras" | "odoo" | "texto";

export type FacturaCandidato = {
  producto: FacturaProductoCatalogo;
  /** alias, barras y odoo son coincidencias exactas; texto es por nombre parecido. */
  senales: FacturaCandidatoSenal[];
  /** 0 a 1, solo cuando el nombre se parece. */
  similitud: number | null;
  presentaciones: Array<{ presentacion: FacturaPresentacion; unidades: number; delProveedor: boolean }>;
  /** Última compra de este producto a este proveedor. */
  ultimaCompra: {
    fecha: string | null;
    descripcion: string | null;
    presentacion: FacturaPresentacion | null;
    cantidad: number | null;
    costoPorPresentacion: number | null;
    costoUnitario: number | null;
  } | null;
};

export type FacturaLineaCandidatos = {
  lineaId: string;
  numeroLinea: number;
  descripcion: string | null;
  codigoSku: string | null;
  codigoBarras: string | null;
  presentacion: FacturaPresentacion | null;
  cantidadComprada: number | null;
  costoPorPresentacion: number | null;
  productoId: string | null;
  propuesta: FacturaPropuesta | null;
  candidatos: FacturaCandidato[];
};

export type FacturaLinea = {
  id: string;
  numeroLinea: number;
  codigoSku: string | null;
  codigoBarras: string | null;
  descripcionOriginal: string | null;
  productoNormalizado: string | null;
  marca: string | null;
  variante: string | null;
  tamano: string | null;
  presentacion: FacturaPresentacion | null;
  presentacionLabel: string | null;
  cantidadComprada: number | null;
  unidadesPorPresentacion: number | null;
  unidadesTotales: number | null;
  costoPorPresentacion: number | null;
  costoUnitario: number | null;
  descuentoLinea: number | null;
  itbisLinea: number | null;
  precioIncluyeItbis: FacturaItbisLinea;
  precioIncluyeItbisLabel: string;
  subtotalLinea: number | null;
  totalLinea: number | null;
  estado: FacturaEstadoLinea;
  estadoLabel: string;
  observacion: string | null;
  productoId: string | null;
  productoCatalogo: FacturaProductoCatalogo | null;
  /** Quién eligió el producto en la plataforma. Null si lo ligó un alias o una propuesta automática. */
  productoConfirmadoPor: string | null;
  productoConfirmadoEn: string | null;
  /** humano cuando lo confirma una persona; propuesta_auto desde 90; alias si ya estaba aprendido. */
  origenLigue: OrigenLigue | null;
  /** Quién escribió las unidades por presentación en la plataforma. */
  unidadesConfirmadoPor: string | null;
  unidadesConfirmadoEn: string | null;
  propuesta: FacturaPropuesta | null;
  recepcion: FacturaRecepcion;
  recepcionLabel: string;
  cantidadRecibida: number | null;
  recepcionPor: string | null;
  recepcionEn: string | null;
  /** Monto que no llegó: costo unitario × (unidades compradas − recibidas). Sin unidades de venta, costo por presentación × (comprada − recibida). Cero si llegó completa o es regalo. */
  diferenciaRecepcion: number | null;
  /** Precio o cantidad fuera de lo normal contra las últimas compras del mismo producto al mismo proveedor. */
  alertas: FacturaLineaAlerta[];
};

export type FacturaLineaAlerta = {
  tipo: "precio" | "cantidad";
  valor: number;
  mediana: number;
  /** (valor − mediana) / mediana. 0.2 es 20% más. */
  variacion: number;
  /** Compras anteriores que entraron en la mediana. */
  compras: number;
  /** precio por unidad, o por presentación cuando la línea no tiene unidades. */
  medida: "unidad" | "presentacion";
  texto: string;
};

export type FacturaProductoCatalogo = {
  id: string;
  nombre: string;
  marca: string | null;
  codigoOdoo: string | null;
  codigoBarras: string | null;
};

export type FacturaCatalogoRef =
  | { accion: "omitir" }
  | { accion: "quitar" }
  | { accion: "id"; id: string }
  | { accion: "codigo"; codigo: string };

export type FacturaValidacion = {
  codigo: FacturaValidacionCodigo;
  codigoLabel: string;
  resultado: FacturaResultado;
  resultadoLabel: string;
  explicacion: string | null;
  revisadoEn: string | null;
};

export type FacturaPregunta = {
  id: string;
  lineaNumero: number | null;
  campo: string | null;
  pregunta: string;
  consultadoA: string | null;
  respuesta: string | null;
  respondidoPor: string | null;
  respondidoEn: string | null;
  evidencia: string | null;
  estado: FacturaPreguntaEstado;
  estadoLabel: string;
  creadoEn: string;
};

export type FacturaDocumento = {
  id: string;
  nombre: string | null;
  mime: string;
  pagina: number | null;
  tipo: FacturaDocumentoTipo;
  esImagen: boolean;
  creadoEn: string;
};

export type FacturaProveedorFicha = {
  id: string;
  nombre: string;
  rnc: string | null;
  tieneCredito: boolean;
  diasCredito: number;
  formaPago: "efectivo" | "transferencia" | "mixto" | null;
};

export type FacturaResumen = {
  id: string;
  clave: string | null;
  referencia: string;
  recibidoEn: string;
  enviadoPor: string | null;
  tienda: string | null;
  tipoDocumento: FacturaTipoDocumento;
  tipoDocumentoLabel: string;
  proveedor: string | null;
  proveedorId: string | null;
  rnc: string | null;
  ncf: string | null;
  numeroFactura: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  condicion: FacturaCondicion | null;
  condicionLabel: string | null;
  metodoPago: string | null;
  moneda: FacturaMoneda;
  subtotal: number | null;
  descuentoTotal: number | null;
  itbisTotal: number | null;
  otrosCargos: number | null;
  total: number | null;
  numeroProductos: number;
  numeroDocumentos: number;
  tieneFoto: boolean;
  estado: FacturaEstado;
  estadoLabel: string;
  estadoAyuda: string;
  observaciones: string | null;
  posibleDuplicado: boolean;
  duplicadoReferencia: string | null;
  preguntasAbiertas: number;
  esCompraPersonal: boolean;
  socio: string | null;
  confirmacionTexto: string | null;
  confirmacionPor: string | null;
  confirmacionEn: string | null;
  problema: boolean;
  problemaDueno: string | null;
  problemaDesde: string | null;
  problemaFalta: string | null;
  ledgerId: string | null;
  compraId: string | null;
  facturaOrigenId: string | null;
  actualizadoEn: string;
};

export type FacturaPagoOrigen = "caja" | "banco";

export type FacturaPago = {
  id: string;
  origen: FacturaPagoOrigen;
  ledgerId: string | null;
  movimientoId: string | null;
  fecha: string | null;
  /** Caja del movimiento, o el banco si vino del estado de cuenta. */
  caja: string | null;
  concepto: string | null;
  referencia: string | null;
  monto: number;
  confirmadoPor: string;
  confirmadoEn: string;
  /** Lo que Fred dejó al ligarlo. */
  confianza: number | null;
  razon: string | null;
};

export type FacturaPagoCandidato = {
  origen: FacturaPagoOrigen;
  ledgerId: string | null;
  movimientoId: string | null;
  fecha: string;
  caja: string | null;
  concepto: string | null;
  referencia: string | null;
  monto: number;
  confianza: number;
};

export type FacturaNotaRef = { id: string; referencia: string; total: number | null; estado: FacturaEstado; estadoLabel: string };

export type FacturaVerificacion = {
  id: string;
  resultado: "cuadra" | "falta" | "diferencia";
  resultadoLabel: string;
  rnc: string | null;
  ncf: string | null;
  montoFactura: number | null;
  montoSistema: number | null;
  montoCaja: number | null;
  montoDgii: number | null;
  nota: string | null;
  creadoEn: string;
};

export type FacturaConciliacion = {
  id: string;
  resultado: "pagada" | "vencida_sin_pagar" | "pagada_sin_movimiento" | "falta_factura";
  resultadoLabel: string;
  medio: "banco" | "caja" | "cardnet" | null;
  medioLabel: string | null;
  fecha: string | null;
  referencia: string | null;
  monto: number | null;
  nota: string | null;
  creadoEn: string;
};

export type FacturaDetalle = FacturaResumen & {
  lineas: FacturaLinea[];
  validaciones: FacturaValidacion[];
  preguntas: FacturaPregunta[];
  documentos: FacturaDocumento[];
  proveedorFicha: FacturaProveedorFicha | null;
  pagos: FacturaPago[];
  /** Salidas de caja que podrían ser el pago. Vacío si ya está conciliada. */
  pagosCandidatos: FacturaPagoCandidato[];
  /** Total menos lo ligado en caja. Null sin total o sin pagos. */
  pagosDiferencia: number | null;
  facturaOrigen: { id: string; referencia: string } | null;
  notasCredito: FacturaNotaRef[];
  verificacion: FacturaVerificacion | null;
  conciliacion: FacturaConciliacion | null;
};

export type FacturasResumen = {
  total: number;
  porEstado: Array<{ id: FacturaEstado; label: string; facturas: number }>;
  preguntasAbiertas: number;
  posiblesDuplicados: number;
  sinFoto: number;
  conProblema: number;
  atencion: number;
};

/** Filas que pinta la administración. El agente sigue pidiendo el lote completo. */
export const FACTURAS_PAGE_SIZE = 40;

export type FacturaListado = {
  facturas: FacturaResumen[];
  total: number;
  page: number;
  pageSize: number;
};

export type FacturaCampos = {
  clave?: string | null;
  recibidoEn?: string | null;
  enviadoPor?: string | null;
  tienda?: string | null;
  tipoDocumento?: FacturaTipoDocumento;
  proveedor?: string | null;
  rnc?: string | null;
  ncf?: string | null;
  numeroFactura?: string | null;
  fechaEmision?: string | null;
  fechaVencimiento?: string | null;
  condicion?: FacturaCondicion | null;
  metodoPago?: string | null;
  moneda?: FacturaMoneda;
  subtotal?: number | null;
  descuentoTotal?: number | null;
  itbisTotal?: number | null;
  otrosCargos?: number | null;
  total?: number | null;
  estado?: FacturaEstado;
  observaciones?: string | null;
  /** Id o clave de la factura original. Solo para notas de crédito. */
  facturaOrigen?: string | null;
};

export type FacturaLineaInput = {
  numeroLinea: number;
  codigoSku: string | null;
  codigoBarras: string | null;
  descripcionOriginal: string | null;
  productoNormalizado: string | null;
  marca: string | null;
  variante: string | null;
  tamano: string | null;
  presentacion: FacturaPresentacion | null;
  cantidadComprada: number | null;
  unidadesPorPresentacion: number | null;
  unidadesTotales: number | null;
  costoPorPresentacion: number | null;
  costoUnitario: number | null;
  descuentoLinea: number | null;
  itbisLinea: number | null;
  precioIncluyeItbis: FacturaItbisLinea;
  subtotalLinea: number | null;
  totalLinea: number | null;
  estado: FacturaEstadoLinea;
  observacion: string | null;
  catalogo: FacturaCatalogoRef;
};

export type FacturaValidacionInput = {
  codigo: FacturaValidacionCodigo;
  resultado: FacturaResultado;
  explicacion: string | null;
  revisadoEn: string | null;
};

export type FacturaPreguntaInput = {
  id?: string | null;
  lineaNumero: number | null;
  campo: string | null;
  pregunta: string;
  consultadoA: string | null;
  respuesta: string | null;
  respondidoPor: string | null;
  respondidoEn: string | null;
  evidencia: string | null;
  estado: FacturaPreguntaEstado;
};

export type DuplicadoCandidato = {
  id: string;
  proveedor: string | null;
  ncf: string | null;
  numeroFactura: string | null;
  fechaEmision: string | null;
  total: number | null;
  tienda: string | null;
  moneda: string;
};

export const FACTURAS_AGENT_USO =
  "Guarda cada factura en la misma ficha, con la foto original. POST /api/agent/facturas manda proveedor, tienda, fechas, montos, lineas (o productos), validaciones, preguntas y la foto: en JSON usa fotoBase64 o documentos[{ pagina, base64 }]; en multipart adjunta el archivo en el campo foto (también vale captura o documento). JPG, PNG, WebP o PDF, hasta 4 MB por archivo. Si hay varias páginas, mándalas todas. Identifica la factura con referencia (proveedor, fecha, monto y tienda): el id es interno y no se menciona en la conversación. Todo se registra en unidades de venta, nunca en cajas, bultos ni presentaciones. Unidades = bultos × unidades por empaque: manda cantidadComprada y unidadesPorPresentacion; la plataforma calcula unidadesTotales y el costo unitario (pagado ÷ unidades pagadas). El total de la línea no cambia. El regalo o FOC va como línea aparte a costo 0. La unidad es lo que se vende en la tienda (por ejemplo, Maria Aldape 25/8 = 25 paquetes y la unidad es el paquete). Si no sabes el empaque, búscalo en este orden: tabla de equivalencias, hoja de proveedores y facturas anteriores del mismo proveedor. Si no aparece, la pregunta va al grupo de la tienda por medio de Rodrigo, y la línea no se registra en cajas mientras tanto. La recepción también se graba en unidades e iguala lo comprado cuando llegó completo. Para cruzar una línea con el catálogo manda productoId o codigoOdoo; si no lo mandas, el producto ya elegido se conserva. Repetir el POST con la misma clave no pisa la factura y responde creado: false; una foto nueva de esa clave sí se guarda. Para corregir usa PATCH. Las etapas son falta_factura, recibida, registrada, verificada y conciliada. Completa cuenta como registrada. Phillip solo puede pasar a registrada cuando Rodrigo confirmó la recepción de todas las líneas (POST /recepcion: completa, faltante o regalo), salvo que sea compra personal. La respuesta de Ramón en texto se guarda igual, como evidencia. Phillip decide el producto de cada línea: pide GET /lineas/candidatos (señales exactas por alias, código de barras u Odoo, nombres parecidos, presentaciones y última compra a ese proveedor) y manda POST /lineas/propuestas con productoId, confianza de 0 a 100 y razon. Un alias ya confirmado para ese proveedor se liga solo; barras (95) y odoo (90) quedan como propuesta de la plataforma. Con aceptar: true, las de 90 o más se ligan y quedan aprendidas; las demás las confirma una persona, y bajo 70 hay que revisarlas. También puede elegir directo con PATCH /lineas/{lineaId} y productoId. Cuando un producto tiene las unidades por empaque en la tabla de equivalencias (POST /api/agent/presentaciones), la plataforma completa las unidades de venta y el costo unitario. La plataforma liga la factura a la ficha del proveedor (primero por RNC, después por nombre), calcula fecha_vencimiento con sus días de crédito si no la mandas, y revisa sola ncf_formato, ncf_unico y rnc_proveedor: no mandes esas tres validaciones, se reemplazan. El ticket de pago se adjunta a la misma ficha con tipo ticket. Una nota de crédito (tipoDocumento nota_credito) manda facturaOrigen con el id o la clave de la factura que corrige; Boris la verifica después de la original y la plataforma la descuenta de la cuenta por pagar. Fred liga los pagos con POST /pagos: ledgerId para caja o movimientoId para un débito del banco ya importado (POST /api/agent/banco), con su confianza de 0 a 100 y razon. pagosCandidatos son solo la lista de movimientos que cuadran en monto y fecha: Fred decide cuál es. Cada línea ligada al catálogo trae alertas cuando su precio o su cantidad se sale de la mediana de las últimas 6 compras del mismo producto al mismo proveedor (15% en precio y 50% en cantidad, se cambian en Parámetros; necesita al menos 3 compras). GET /api/agent/pendientes dice qué le falta a cada factura y a quién le toca. Si una persona confirma el producto en la plataforma, la línea queda ligada: trae productoConfirmadoPor, productoConfirmadoEn y origenLigue (humano, propuesta_auto o alias). Una línea ambigua pasa a completa y se cierran las preguntas abiertas con campo productoId, con respuesta y evidencia «Confirmado por <usuario> en UI». Phillip no vuelve a preguntar ese producto. Ese ligue publica el evento linea.confirmada con facturaId, numeroLinea, productoId y por. Si la persona edita las unidades por empaque, queda quién las confirmó y se cierra la pregunta de unidades de esa línea. En la ficha se pueden confirmar de una vez las propuestas de 70 a 89. Cada bot escribe con su propio token.";

export const FACTURAS_AGENT_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/agent/facturas?estado=&q=&tienda=&pendientes=true&duplicados=true",
    describe: "Vocabulario, conteos y el listado. Cada factura trae referencia para hablar con una persona, y id solo para las llamadas siguientes.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas",
    describe:
      "Crea la factura y sube la foto. JSON: fotoBase64 o documentos[{ nombre, pagina, base64 }]. Multipart: archivo en foto, captura o documento, y el resto de los campos como texto (lineas y validaciones van en JSON dentro del campo). JPG, PNG, WebP o PDF, hasta 4 MB. clave es opcional. Si ya existe, responde 200 con creado: false, no pisa los datos y sí guarda una foto nueva.",
  },
  {
    method: "GET",
    path: "/api/agent/facturas/{id-o-clave}",
    describe:
      "La factura completa: cabecera, productos (con alertas de precio y cantidad, productoConfirmadoPor, productoConfirmadoEn y origenLigue), validaciones, preguntas, documentos, pagos ligados de caja y banco, pagosCandidatos, pagosDiferencia, facturaOrigen (si es nota de crédito) y notasCredito (si es la original).",
  },
  {
    method: "PATCH",
    path: "/api/agent/facturas/{id-o-clave}",
    describe:
      "Actualiza solo los campos enviados. lineas o productos hace upsert por numeroLinea; reemplazarLineas: true borra las que no mandes. validaciones hace upsert por codigo. preguntas nuevas se agregan y, si traen id, se actualizan.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/lineas",
    describe:
      "Agrega o corrige productos. El mismo numeroLinea actualiza la fila. Para enlazar el catálogo manda productoId o codigoOdoo. Todo se registra en unidades de venta: manda unidadesPorPresentacion (unidades por empaque) y la plataforma calcula unidadesTotales = cantidad × empaque y el costo unitario (pagado ÷ unidades pagadas). El total de la línea no cambia. Sin el empaque la línea no se registra en cajas, bultos ni presentaciones.",
  },
  {
    method: "PATCH",
    path: "/api/agent/facturas/{id-o-clave}/lineas/{lineaId}",
    describe: "Phillip elige el producto de una línea: productoId (null para quitarlo) o aceptarPropuesta: true. Queda aprendido para ese proveedor y la próxima factura se liga sola. Si lo confirma una persona en la plataforma, origenLigue es humano, con productoConfirmadoPor y productoConfirmadoEn, y se publica linea.confirmada.",
  },
  {
    method: "GET",
    path: "/api/agent/facturas/{id-o-clave}/lineas/candidatos",
    describe:
      "Phillip pide los candidatos del catálogo para cada línea sin producto (todas=true incluye las ya ligadas). Cada candidato trae producto, senales exactas (alias, barras, odoo) o texto con similitud, presentaciones guardadas y la última compra a ese proveedor. La plataforma no decide: Phillip propone.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/lineas/propuestas",
    describe:
      "Phillip deja su propuesta por línea: propuestas: [{ numeroLinea o lineaId, productoId o codigoOdoo, confianza (0 a 100), razon }]. Con aceptar: true liga de una vez las de 90 o más y quedan aprendidas para ese proveedor; las demás esperan a una persona. Bajo 70 queda para revisión.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/lineas/aceptar",
    describe: "Phillip acepta de una vez las propuestas de 90 o más (suyas o por alias, código de barras o código de Odoo): quedan como origenLigue propuesta_auto. Una persona puede confirmar las de 70 a 89 con minimo y maximo; esas quedan como humano. Responde aceptadas y la factura.",
  },
  {
    method: "POST",
    path: "/api/agent/presentaciones",
    describe:
      "Tabla de equivalencias. Phillip guarda cuántas unidades de venta trae el empaque: productoId, presentacion (paquete, caja, fardo u otro), unidades y, si es solo de un proveedor, proveedorId. Con eso se completan las unidades de venta y el costo unitario de las líneas de ese producto.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/validaciones",
    describe: "Registra resultado (correcto, diferencia, pendiente, no_aplica), explicacion y la fecha de revisión. El codigo puede ser el id o la etiqueta.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/preguntas",
    describe: "Abre una duda: campo, pregunta y a quién se consultó. Si ya mandas respuesta, queda resuelta.",
  },
  {
    method: "PATCH",
    path: "/api/agent/facturas/{id-o-clave}/preguntas/{preguntaId}",
    describe: "Guarda la respuesta, quién respondió, la evidencia y el estado abierta o resuelta.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/documentos",
    describe: "Adjunta otra página o el ticket de pago a la misma ficha. documentos: [{ nombre, pagina, base64 }] para páginas y [{ tipo: \"ticket\", base64 }] para el ticket. Una foto repetida no se duplica.",
  },
  {
    method: "GET",
    path: "/api/agent/facturas/{id-o-clave}/documentos/{documentoId}",
    describe: "Descarga la foto o el PDF original.",
  },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADO_ALIAS: Record<string, FacturaEstado> = {
  completa: "registrada",
  en_analisis: "recibida",
  analizando: "recibida",
  pendiente: "recibida",
  pendiente_de_informacion: "recibida",
  pendiente_informacion: "recibida",
  respuesta_recibida: "recibida",
  incompleta: "recibida",
  duplicada: "recibida",
  duplicado: "recibida",
  posible_duplicado: "recibida",
  no_valido: "recibida",
  invalido: "recibida",
  documento_invalido: "recibida",
  documento_no_valido: "recibida",
  escalada: "recibida",
  falta_de_factura: "falta_factura",
  sin_factura: "falta_factura",
  registrado: "registrada",
  registrada: "registrada",
  verificado: "verificada",
  conciliado: "conciliada",
};

const TIPO_ALIAS: Record<string, FacturaTipoDocumento> = {
  nota_de_credito: "nota_credito",
  nc: "nota_credito",
  cotizacion: "cotizacion",
  quote: "cotizacion",
};

const PRESENTACION_ALIAS: Record<string, FacturaPresentacion> = {
  unidades: "unidad",
  unitario: "unidad",
  paquetes: "paquete",
  cajas: "caja",
  fardos: "fardo",
  otra: "otro",
};

const VALIDACION_ALIAS: Record<string, FacturaValidacionCodigo> = {
  suma_de_lineas: "suma_lineas",
  suma_de_lineas_coincide_con_subtotal: "suma_lineas",
  itbis_recalculado: "itbis",
  itbis_recalculado_coincide: "itbis",
  total_recalculado: "total",
  total_recalculado_coincide: "total",
  ncf: "ncf_legible",
  numero_de_factura: "numero_legible",
  numero_de_factura_legible: "numero_legible",
  numero_factura_legible: "numero_legible",
  factura_duplicada: "posible_duplicado",
  posible_factura_duplicada: "posible_duplicado",
  duplicado: "posible_duplicado",
  paginas_recibidas: "paginas",
  todas_las_paginas: "paginas",
  todas_las_paginas_recibidas: "paginas",
  cantidades_y_presentaciones: "cantidades",
  cantidades_y_presentaciones_claras: "cantidades",
  diferencia: "diferencia_matematica",
  diferencia_matematica_detectada: "diferencia_matematica",
  documento: "documento_completo",
  documento_completo_o_incompleto: "documento_completo",
};

const RESULTADO_ALIAS: Record<string, FacturaResultado> = {
  ok: "correcto",
  coincide: "correcto",
  no_coincide: "diferencia",
  diferencia_detectada: "diferencia",
  na: "no_aplica",
  noaplica: "no_aplica",
};

const ITBIS_ALIAS: Record<string, FacturaItbisLinea> = {
  yes: "si",
  true: "si",
  false: "no",
  desconocido: "no_determinado",
  no_se: "no_determinado",
};

const PREGUNTA_ALIAS: Record<string, FacturaPreguntaEstado> = {
  abierto: "abierta",
  resuelto: "resuelta",
  cerrada: "resuelta",
};

const LINEA_ALIAS: Record<string, FacturaEstadoLinea> = {
  dudosa: "ambigua",
  no_se_lee: "ilegible",
};

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function parseClave(value: unknown): { ok: true; clave: string | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, clave: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "La clave tiene que ser texto" };
  }
  const clave = value.trim();
  if (!clave) {
    return { ok: true, clave: null };
  }
  if (clave.length > 80 || !/^[A-Za-z0-9_.:-]+$/.test(clave)) {
    return { ok: false, message: "La clave solo puede tener letras, números, punto, guión y guión bajo" };
  }
  return { ok: true, clave };
}

function parseEnum<T extends string>(
  list: readonly { id: T; label: string }[],
  value: unknown,
  alias: Record<string, T>
): T | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const token = normalizeToken(value);
  const aliased = alias[token];
  if (aliased && list.some((item) => item.id === aliased)) {
    return aliased;
  }
  const byId = list.find((item) => item.id === token);
  if (byId) {
    return byId.id;
  }
  return list.find((item) => normalizeToken(item.label) === token)?.id ?? null;
}

export function parseEstado(value: unknown): FacturaEstado | null {
  return parseEnum(FACTURA_ESTADOS, value, ESTADO_ALIAS);
}

export function parseTipoDocumento(value: unknown): FacturaTipoDocumento | null {
  return parseEnum(FACTURA_TIPOS, value, TIPO_ALIAS);
}

export function parseCondicion(value: unknown): FacturaCondicion | null {
  return parseEnum(FACTURA_CONDICIONES, value, {});
}

export function parseMoneda(value: unknown): FacturaMoneda | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const token = normalizeToken(value);
  if (token === "rd" || token === "dop" || token === "rd$" || token === "peso" || token === "pesos") {
    return "DOP";
  }
  if (token === "usd" || token === "us" || token === "dolar" || token === "dolares") {
    return "USD";
  }
  if (token === "eur" || token === "euro" || token === "euros") {
    return "EUR";
  }
  return parseEnum(FACTURA_MONEDAS, value, {});
}

export function parsePresentacion(value: unknown): FacturaPresentacion | null {
  return parseEnum(FACTURA_PRESENTACIONES, value, PRESENTACION_ALIAS);
}

export function parseEstadoLinea(value: unknown): FacturaEstadoLinea | null {
  return parseEnum(FACTURA_ESTADOS_LINEA, value, LINEA_ALIAS);
}

export function parseItbisLinea(value: unknown): FacturaItbisLinea | null {
  if (typeof value === "boolean") {
    return value ? "si" : "no";
  }
  return parseEnum(FACTURA_ITBIS_LINEA, value, ITBIS_ALIAS);
}

export function parseValidacionCodigo(value: unknown): FacturaValidacionCodigo | null {
  return parseEnum(FACTURA_VALIDACIONES, value, VALIDACION_ALIAS);
}

export function parseResultado(value: unknown): FacturaResultado | null {
  return parseEnum(FACTURA_RESULTADOS, value, RESULTADO_ALIAS);
}

export function parsePreguntaEstado(value: unknown): FacturaPreguntaEstado | null {
  return parseEnum(FACTURA_PREGUNTA_ESTADOS, value, PREGUNTA_ALIAS);
}

export function mensajeEstadoInvalido(): string {
  return `El estado no es válido. Usa ${FACTURA_ESTADOS.map((item) => item.id).join(", ")}`;
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function parseMoney(value: unknown, label: string): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, message: `${label} no es un monto válido` };
    }
    return { ok: true, value: roundTo(value, 2) };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${label} no es un monto válido` };
  }
  let text = value.trim().replace(/\s/g, "").replace(/^(RD\$|US\$|USD|DOP|EUR|€)/i, "");
  if (!text) {
    return { ok: true, value: null };
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) || /^-?\d+,\d{1,4}$/.test(text)) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    return { ok: false, message: `${label} no es un monto válido` };
  }
  return { ok: true, value: roundTo(number, 2) };
}

export function parseCantidad(value: unknown, label: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const parsed = parseMoney(value, label);
  if (!parsed.ok || parsed.value == null) {
    return parsed;
  }
  if (parsed.value < 0) {
    return { ok: false, message: `${label} no puede ser negativa` };
  }
  return { ok: true, value: roundTo(parsed.value, 3) };
}

export function parseFecha(value: unknown, label: string): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  const key = calendarDayKey(value);
  if (!key) {
    return { ok: false, message: `${label} tiene que usar el formato YYYY-MM-DD` };
  }
  return { ok: true, value: key };
}

export function parseFechaHora(value: unknown, label: string): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { ok: false, message: `${label} no es una fecha válida` };
    }
    return { ok: true, value: value.toISOString() };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${label} tiene que ser fecha y hora` };
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: `${label} no es una fecha válida` };
  }
  return { ok: true, value: date.toISOString() };
}

export function formatMonto(value: number | null, moneda: string = "DOP"): string {
  if (value == null) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  if (moneda === "USD") {
    return `US$${formatted}`;
  }
  if (moneda === "EUR") {
    return `€${formatted}`;
  }
  return `RD$${formatted}`;
}

export function referenciaFactura(input: {
  proveedor: string | null;
  fechaEmision: string | null;
  recibidoEn?: string | null;
  total: number | null;
  moneda: string;
  tienda: string | null;
}): string {
  const fecha = input.fechaEmision ?? (input.recibidoEn ? input.recibidoEn.slice(0, 10) : null);
  const monto = input.total == null ? null : formatMonto(input.total, input.moneda);
  const parts = [input.proveedor, fecha, monto, input.tienda].filter((part): part is string => Boolean(part && part !== "—"));
  return parts.join(" · ") || "Factura sin datos";
}

export function buscarDuplicado(
  actual: { id?: string | null; proveedor: string | null; ncf: string | null; numeroFactura: string | null; fechaEmision: string | null },
  candidatos: DuplicadoCandidato[]
): { candidato: DuplicadoCandidato; motivo: "ncf" | "numero" } | null {
  const ncf = actual.ncf?.trim().toUpperCase() || null;
  const proveedor = actual.proveedor?.trim().toLowerCase() || null;
  const numero = actual.numeroFactura?.trim().toLowerCase() || null;
  for (const candidato of candidatos) {
    if (actual.id && candidato.id === actual.id) {
      continue;
    }
    if (ncf && candidato.ncf?.trim().toUpperCase() === ncf) {
      return { candidato, motivo: "ncf" };
    }
    if (
      proveedor &&
      numero &&
      actual.fechaEmision &&
      candidato.proveedor?.trim().toLowerCase() === proveedor &&
      candidato.numeroFactura?.trim().toLowerCase() === numero &&
      candidato.fechaEmision === actual.fechaEmision
    ) {
      return { candidato, motivo: "numero" };
    }
  }
  return null;
}

export function explicacionDuplicado(motivo: "ncf" | "numero", referencia: string): string {
  if (motivo === "ncf") {
    return `Hay otra factura con el mismo NCF: ${referencia}`;
  }
  return `Hay otra factura del mismo proveedor, número y fecha: ${referencia}`;
}

const PRESENTACIONES_CON_EMPAQUE = new Set<FacturaPresentacion>(["paquete", "caja", "fardo", "otro"]);

export const LINEA_SIN_EMPAQUE =
  "La línea no se registra en cajas, bultos ni presentaciones sin las unidades por empaque. Busca el empaque en la tabla de equivalencias, la hoja de proveedores y facturas anteriores del mismo proveedor; si no aparece, la pregunta va al grupo de la tienda por medio de Rodrigo.";

export function resolverUnidades(input: {
  presentacion: FacturaPresentacion | null;
  cantidadComprada: number | null;
  unidadesPorPresentacion: number | null;
  unidadesTotales: number | null;
  costoPorPresentacion: number | null;
  costoUnitario: number | null;
}): { unidadesPorPresentacion: number | null; unidadesTotales: number | null; costoUnitario: number | null; aviso: string | null } {
  const known = input.unidadesPorPresentacion ?? (input.presentacion === "unidad" ? 1 : null);
  if (known == null) {
    if (input.presentacion && PRESENTACIONES_CON_EMPAQUE.has(input.presentacion)) {
      throw new Error(LINEA_SIN_EMPAQUE);
    }
    return {
      unidadesPorPresentacion: null,
      unidadesTotales: input.unidadesTotales,
      costoUnitario: input.costoUnitario,
      aviso: null,
    };
  }
  if (!(known > 0)) {
    throw new Error("Las unidades por empaque tienen que ser mayores que cero");
  }
  const unidadesTotales = input.cantidadComprada == null ? null : roundTo(input.cantidadComprada * known, 3);
  const costoUnitario = input.costoPorPresentacion == null ? null : roundTo(input.costoPorPresentacion / known, 4);
  const aviso =
    input.unidadesTotales != null && unidadesTotales != null && Math.abs(input.unidadesTotales - unidadesTotales) > 0.001
      ? "Las unidades de venta se recalcularon: bultos × unidades por empaque. El total de la línea no cambia."
      : null;
  return {
    unidadesPorPresentacion: known,
    unidadesTotales,
    costoUnitario,
    aviso,
  };
}

/** Una salida de caja cuenta como el pago si cae a ±1 día y a ±RD$ 5 del total. */
export const PAGO_DIAS = 1;
export const PAGO_TOLERANCIA = 5;

function palabrasProveedor(proveedor: string | null): string[] {
  const norm = normalizarDescripcion(proveedor);
  if (!norm) {
    return [];
  }
  const vacias = new Set(["srl", "sas", "sa", "eirl", "distribuidora", "comercial", "industrias", "grupo", "dominicana", "del", "las", "los"]);
  return norm.split(" ").filter((palabra) => palabra.length >= 4 && !vacias.has(palabra));
}

/** Null si el movimiento no puede ser el pago. Si no, 70 a 100 según monto, fecha y si el concepto nombra al proveedor. */
export function confianzaPago(input: {
  total: number;
  monto: number;
  diasDeDiferencia: number;
  proveedor: string | null;
  concepto: string | null;
  referencia: string | null;
  /** Por defecto PAGO_DIAS (caja). El banco pasa la distancia a su ventana y BANCO_DIAS_DESPUES. */
  maxDias?: number;
}): number | null {
  const diferencia = Math.abs(input.monto - input.total);
  if (diferencia > PAGO_TOLERANCIA || Math.abs(input.diasDeDiferencia) > (input.maxDias ?? PAGO_DIAS)) {
    return null;
  }
  let confianza = diferencia <= 1 ? 80 : 70;
  if (input.diasDeDiferencia === 0) {
    confianza += 5;
  }
  const texto = normalizarDescripcion([input.concepto, input.referencia].filter(Boolean).join(" ")) ?? "";
  if (palabrasProveedor(input.proveedor).some((palabra) => texto.split(" ").includes(palabra))) {
    confianza += 15;
  }
  return Math.min(100, confianza);
}

export function diferenciaPagos(total: number | null, pagos: Array<{ monto: number }>): number | null {
  if (total == null || !pagos.length) {
    return null;
  }
  return roundTo(total - pagos.reduce((sum, pago) => sum + pago.monto, 0), 2);
}

/** Confianza de una coincidencia por nombre. Nunca llega a 90, así «aceptar todas» no toma coincidencias de texto. */
export function confianzaTexto(similitud: number): number {
  if (!Number.isFinite(similitud)) {
    return 0;
  }
  return Math.max(0, Math.min(85, Math.round(similitud * 120)));
}

export function normalizarDescripcion(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const text = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return text.length >= 2 ? text.slice(0, 300) : null;
}

function compactarCampo(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const CAMPOS_PRODUCTO = new Set(["productoid", "producto"]);
const CAMPOS_UNIDADES = new Set(["unidadesporpresentacion", "unidadesporcaja", "unidades"]);

/** La pregunta pide el producto de la línea (productoId, producto_id o producto). */
export function esCampoProducto(campo: string | null): boolean {
  return campo != null && CAMPOS_PRODUCTO.has(compactarCampo(campo));
}

/** La pregunta pide las unidades por presentación de la línea. */
export function esCampoUnidades(campo: string | null): boolean {
  return campo != null && CAMPOS_UNIDADES.has(compactarCampo(campo));
}

/** Respuesta y evidencia con las que se cierra una pregunta confirmada en la plataforma. */
export function textoConfirmacionUi(usuario: string): string {
  const nombre = usuario.trim() || "una persona";
  return `Confirmado por ${nombre} en UI`;
}

/** Una línea ambigua deja de serlo cuando el producto queda ligado. El resto de estados se conserva. */
export function estadoTrasLigue(estado: FacturaEstadoLinea): FacturaEstadoLinea {
  return estado === "ambigua" ? "completa" : estado;
}

/**
 * Claves del alias, de la más específica a la descripción sola.
 * La descripción del proveedor más el código SKU identifica el producto; si no hay SKU, basta la descripción.
 */
export function clavesAlias(descripcion: string | null, codigoSku: string | null = null): string[] {
  const desc = normalizarDescripcion(descripcion);
  if (!desc) {
    return [];
  }
  const claves: string[] = [];
  const sku = normalizarDescripcion(codigoSku);
  if (sku) {
    const junta = normalizarDescripcion(`${descripcion ?? ""} ${codigoSku ?? ""}`);
    if (junta && junta !== desc) {
      claves.push(junta);
    }
  }
  claves.push(desc);
  return claves;
}

export function propuestasEnBanda<T extends { productoId: string | null; propuesta: { confianza: number } | null }>(
  lineas: T[],
  minimo: number,
  maximo: number
): T[] {
  return lineas.filter((linea) => !linea.productoId && linea.propuesta != null && linea.propuesta.confianza >= minimo && linea.propuesta.confianza <= maximo);
}

/** Rango de confianza para aceptar propuestas. Phillip solo desde 90; una persona puede bajar hasta 70. */
export function leerRangoPropuestas(body: { minimo?: unknown; maximo?: unknown }, actor: "admin" | "phillip"): { minimo: number; maximo: number } {
  const minimo = leerEnteroRango(body.minimo, PROPUESTA_ACEPTAR_TODAS);
  const maximo = leerEnteroRango(body.maximo, 100);
  if (!Number.isInteger(minimo) || !Number.isInteger(maximo) || minimo < PROPUESTA_UMBRAL || maximo > 100 || minimo > maximo) {
    throw new Error("El rango de confianza tiene que ir de 70 a 100");
  }
  if (actor !== "admin" && minimo < PROPUESTA_ACEPTAR_TODAS) {
    throw new Error("Solo una persona confirma propuestas bajo 90");
  }
  return { minimo, maximo };
}

function leerEnteroRango(value: unknown, fallback: number): number {
  if (value == null || value === "") {
    return fallback;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number) : Number.NaN;
}

export function diferenciaRecepcion(linea: {
  recepcion: FacturaRecepcion;
  cantidadComprada: number | null;
  cantidadRecibida: number | null;
  costoPorPresentacion: number | null;
  totalLinea: number | null;
  unidadesTotales?: number | null;
  costoUnitario?: number | null;
}): number | null {
  if (linea.recepcion === "pendiente") {
    return null;
  }
  if (linea.recepcion !== "faltante") {
    return 0;
  }
  const enUnidades = linea.unidadesTotales != null;
  const compradas = enUnidades ? linea.unidadesTotales : linea.cantidadComprada;
  if (compradas == null || linea.cantidadRecibida == null) {
    return null;
  }
  const costo = enUnidades
    ? (linea.costoUnitario ?? (linea.totalLinea != null && compradas > 0 ? linea.totalLinea / compradas : null))
    : (linea.costoPorPresentacion ?? (linea.totalLinea != null && compradas > 0 ? linea.totalLinea / compradas : null));
  if (costo == null) {
    return null;
  }
  return roundTo(costo * Math.max(0, compradas - linea.cantidadRecibida), 2);
}

export type RecepcionResumen = { lineas: number; sinConfirmar: number; faltantes: number; regalos: number; diferencia: number };

export function resumenRecepcion(lineas: Array<Pick<FacturaLinea, "recepcion" | "diferenciaRecepcion">>): RecepcionResumen {
  return lineas.reduce<RecepcionResumen>(
    (total, linea) => ({
      lineas: total.lineas + 1,
      sinConfirmar: total.sinConfirmar + (linea.recepcion === "pendiente" ? 1 : 0),
      faltantes: total.faltantes + (linea.recepcion === "faltante" ? 1 : 0),
      regalos: total.regalos + (linea.recepcion === "regalo" ? 1 : 0),
      diferencia: roundTo(total.diferencia + (linea.diferenciaRecepcion ?? 0), 2),
    }),
    { lineas: 0, sinConfirmar: 0, faltantes: 0, regalos: 0, diferencia: 0 }
  );
}

export type RecepcionLineaInput = { numeroLinea: number; recepcion: FacturaRecepcion; cantidadRecibida: number | null };

export function parseRecepcion(value: unknown): FacturaRecepcion | null {
  const text = typeof value === "string" ? normalizeToken(value) : "";
  const alias: Record<string, FacturaRecepcion> = {
    completa: "completa",
    completo: "completa",
    llego: "completa",
    ok: "completa",
    faltante: "faltante",
    falta: "faltante",
    incompleta: "faltante",
    regalo: "regalo",
    bonificacion: "regalo",
    pendiente: "pendiente",
    sin_confirmar: "pendiente",
  };
  return alias[text] ?? null;
}

/** Lee lineas[{ numeroLinea, recepcion, cantidadRecibida }] o todas: "completa". */
export function leerRecepcion(body: Record<string, unknown>): { todas: FacturaRecepcion | null; lineas: RecepcionLineaInput[]; por: string | null } {
  const por = typeof body.por === "string" && body.por.trim() ? body.por.trim().slice(0, 160) : typeof body.recibidoPor === "string" && body.recibidoPor.trim() ? body.recibidoPor.trim().slice(0, 160) : null;
  const todasRaw = body.todas ?? body.todo;
  if (todasRaw != null && todasRaw !== "") {
    const todas = parseRecepcion(todasRaw);
    if (todas !== "completa" && todas !== "pendiente") {
      throw new Error("El campo todas solo puede ser completa o pendiente. Los faltantes y regalos van por línea");
    }
    return { todas, lineas: [], por };
  }
  if (!Array.isArray(body.lineas) || body.lineas.length === 0) {
    throw new Error("Manda lineas[{ numeroLinea, recepcion, cantidadRecibida }] o todas: \"completa\"");
  }
  const vistas = new Set<number>();
  const lineas = body.lineas.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`La línea ${index + 1} de la recepción no es válida`);
    }
    const raw = item as Record<string, unknown>;
    const numero = Number(raw.numeroLinea ?? raw.numero_linea ?? raw.linea);
    if (!Number.isInteger(numero) || numero < 1) {
      throw new Error(`La línea ${index + 1} de la recepción necesita numeroLinea`);
    }
    if (vistas.has(numero)) {
      throw new Error(`La línea ${numero} está repetida en la recepción`);
    }
    vistas.add(numero);
    const recepcion = parseRecepcion(raw.recepcion ?? raw.estado);
    if (!recepcion) {
      throw new Error(`La línea ${numero} necesita recepcion: completa, faltante, regalo o pendiente`);
    }
    const cantidadRaw = raw.cantidadRecibida ?? raw.cantidad_recibida ?? raw.recibida;
    let cantidadRecibida: number | null = null;
    if (cantidadRaw != null && cantidadRaw !== "") {
      const cantidad = typeof cantidadRaw === "number" ? cantidadRaw : Number(String(cantidadRaw).replace(",", "."));
      if (!Number.isFinite(cantidad) || cantidad < 0) {
        throw new Error(`La cantidad recibida de la línea ${numero} no es válida`);
      }
      cantidadRecibida = cantidad;
    }
    return { numeroLinea: numero, recepcion, cantidadRecibida };
  });
  return { todas: null, lineas, por };
}

/** Cantidad que se guarda, en unidades de venta si la línea ya las tiene, si no en lo comprado. */
export function cantidadRecibidaDe(input: RecepcionLineaInput, cantidadComprada: number | null, unidadesTotales: number | null = null): number | null {
  const compradas = unidadesTotales ?? cantidadComprada;
  if (input.recepcion === "pendiente") {
    return null;
  }
  if (input.recepcion === "completa") {
    return compradas;
  }
  if (input.recepcion === "regalo") {
    return input.cantidadRecibida ?? compradas;
  }
  if (input.cantidadRecibida == null) {
    throw new Error(`La línea ${input.numeroLinea} es faltante: manda cuántas llegaron en cantidadRecibida (0 si no llegó nada)`);
  }
  if (compradas != null && input.cantidadRecibida >= compradas) {
    throw new Error(`En la línea ${input.numeroLinea} llegaron ${input.cantidadRecibida} de ${compradas}: eso es completa, no faltante`);
  }
  return input.cantidadRecibida;
}

export function completarValidaciones(stored: FacturaValidacion[]): FacturaValidacion[] {
  return FACTURA_VALIDACIONES.map((item) => {
    const found = stored.find((row) => row.codigo === item.id);
    if (found) {
      return { ...found, codigoLabel: item.label };
    }
    return {
      codigo: item.id,
      codigoLabel: item.label,
      resultado: "pendiente",
      resultadoLabel: "Pendiente",
      explicacion: null,
      revisadoEn: null,
    };
  });
}

const TIPOS_SIN_NCF: FacturaTipoDocumento[] = ["conduce", "recibo", "cotizacion"];

/** ncf_formato, ncf_unico y rnc_proveedor. otraConMismoNcf es la referencia de otra factura con el mismo RNC y NCF. */
export function validacionesFiscales(input: {
  tipoDocumento: FacturaTipoDocumento;
  rnc: string | null;
  ncf: string | null;
  proveedor: Pick<FacturaProveedorFicha, "nombre" | "rnc"> | null;
  otraConMismoNcf: string | null;
  revisadoEn: string;
}): FacturaValidacionInput[] {
  const { tipoDocumento, rnc, ncf, proveedor, otraConMismoNcf, revisadoEn } = input;
  const sinNcf = TIPOS_SIN_NCF.includes(tipoDocumento);
  const result = (codigo: FacturaValidacionCodigo, resultado: FacturaResultado, explicacion: string): FacturaValidacionInput => ({
    codigo,
    resultado,
    explicacion,
    revisadoEn,
  });

  let formato: FacturaValidacionInput;
  if (!ncf) {
    formato = sinNcf ? result("ncf_formato", "no_aplica", `Un ${labelOf(FACTURA_TIPOS, tipoDocumento).toLowerCase()} no lleva NCF.`) : result("ncf_formato", "pendiente", "Falta el NCF.");
  } else {
    const revision = revisarNcf(ncf);
    if (!revision.ok) {
      formato = result("ncf_formato", "diferencia", `${revision.ncf}: ${revision.motivo}.`);
    } else if (tipoDocumento === "nota_credito" && !revision.esNotaCredito) {
      formato = result("ncf_formato", "diferencia", `Es una nota de crédito, pero ${revision.tipo} es ${revision.tipoLabel.toLowerCase()}. Debe ser B04 o E34.`);
    } else if (tipoDocumento === "factura" && revision.esNotaCredito) {
      formato = result("ncf_formato", "diferencia", `${revision.tipo} es una nota de crédito. Cambia el tipo de documento o revisa el NCF.`);
    } else {
      formato = result("ncf_formato", "correcto", `${revision.tipo}, ${revision.tipoLabel.toLowerCase()}.`);
    }
  }

  let unico: FacturaValidacionInput;
  if (!ncf || !rnc) {
    unico = sinNcf && !ncf ? result("ncf_unico", "no_aplica", "No lleva NCF.") : result("ncf_unico", "pendiente", !ncf ? "Falta el NCF." : "Falta el RNC.");
  } else if (otraConMismoNcf) {
    unico = result("ncf_unico", "diferencia", `El RNC ${rnc} con el NCF ${ncf} ya está en ${otraConMismoNcf}.`);
  } else {
    unico = result("ncf_unico", "correcto", "Ninguna otra factura tiene ese RNC y NCF.");
  }

  let rncProveedor: FacturaValidacionInput;
  if (rnc && rnc.length !== 9 && rnc.length !== 11) {
    rncProveedor = result("rnc_proveedor", "diferencia", `El RNC ${rnc} no tiene 9 ni 11 dígitos.`);
  } else if (!proveedor) {
    rncProveedor = result("rnc_proveedor", "pendiente", "La factura no está ligada a un proveedor de la lista.");
  } else if (!rnc) {
    rncProveedor = result("rnc_proveedor", "pendiente", "Falta el RNC de la factura.");
  } else if (!proveedor.rnc) {
    rncProveedor = result("rnc_proveedor", "pendiente", `La ficha de ${proveedor.nombre} no tiene RNC. Agrégalo en Proveedores.`);
  } else if (proveedor.rnc !== rnc) {
    rncProveedor = result("rnc_proveedor", "diferencia", `La factura dice ${rnc}, pero la ficha de ${proveedor.nombre} dice ${proveedor.rnc}.`);
  } else {
    rncProveedor = result("rnc_proveedor", "correcto", `Coincide con la ficha de ${proveedor.nombre}.`);
  }

  return [formato, unico, rncProveedor];
}

function hasKey(body: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function pick(body: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key];
    }
  }
  return undefined;
}

function textOrNull(value: unknown, max: number): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).slice(0, max);
  }
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, max);
  return text || null;
}

function requireMoney(value: unknown, label: string): number | null {
  const parsed = parseMoney(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

function requireCantidad(value: unknown, label: string): number | null {
  const parsed = parseCantidad(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

function requireFecha(value: unknown, label: string): string | null {
  const parsed = parseFecha(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

function requireFechaHora(value: unknown, label: string): string | null {
  const parsed = parseFechaHora(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

export function leerCamposFactura(body: Record<string, unknown>, mode: "create" | "patch"): { campos: FacturaCampos; estadoExplicito: boolean } {
  const campos: FacturaCampos = {};
  const take = (keys: string[], apply: (value: unknown) => void) => {
    if (mode === "patch" && !hasKey(body, keys)) {
      return;
    }
    if (mode === "create" && !hasKey(body, keys)) {
      return;
    }
    apply(pick(body, keys));
  };

  take(["clave"], (value) => {
    const parsed = parseClave(value);
    if (!parsed.ok) {
      throw new Error(parsed.message);
    }
    campos.clave = parsed.clave;
  });
  take(["recibidoEn", "recibido_en", "fechaRecepcion"], (value) => {
    campos.recibidoEn = requireFechaHora(value, "La fecha de recepción");
  });
  take(["enviadoPor", "enviado_por"], (value) => {
    campos.enviadoPor = textOrNull(value, 160);
  });
  take(["tienda"], (value) => {
    campos.tienda = textOrNull(value, 160);
  });
  take(["tipoDocumento", "tipo_documento", "tipo"], (value) => {
    const tipo = parseTipoDocumento(value);
    if (!tipo) {
      throw new Error(`El tipo de documento no es válido. Usa ${FACTURA_TIPOS.map((item) => item.id).join(", ")}`);
    }
    campos.tipoDocumento = tipo;
  });
  take(["proveedor"], (value) => {
    campos.proveedor = textOrNull(value, 200);
  });
  take(["rnc"], (value) => {
    const text = textOrNull(value, 20);
    campos.rnc = text ? text.replace(/\D/g, "") || text : null;
  });
  take(["ncf"], (value) => {
    const text = textOrNull(value, 20);
    campos.ncf = text ? text.toUpperCase().replace(/[^A-Z0-9]/g, "") || null : null;
  });
  take(["numeroFactura", "numero_factura", "numero"], (value) => {
    campos.numeroFactura = textOrNull(value, 80);
  });
  take(["fechaEmision", "fecha_emision", "fecha"], (value) => {
    campos.fechaEmision = requireFecha(value, "La fecha de emisión");
  });
  take(["fechaVencimiento", "fecha_vencimiento", "vencimiento"], (value) => {
    campos.fechaVencimiento = requireFecha(value, "La fecha de vencimiento");
  });
  take(["condicion"], (value) => {
    if (value == null || value === "") {
      campos.condicion = null;
      return;
    }
    const condicion = parseCondicion(value);
    if (!condicion) {
      throw new Error("La condición tiene que ser contado o credito");
    }
    campos.condicion = condicion;
  });
  take(["metodoPago", "metodo_pago"], (value) => {
    campos.metodoPago = textOrNull(value, 80);
  });
  take(["moneda"], (value) => {
    const moneda = parseMoneda(value);
    if (!moneda) {
      throw new Error("La moneda tiene que ser DOP, USD o EUR");
    }
    campos.moneda = moneda;
  });
  take(["subtotal"], (value) => {
    campos.subtotal = requireMoney(value, "El subtotal");
  });
  take(["descuentoTotal", "descuento_total", "descuento"], (value) => {
    campos.descuentoTotal = requireMoney(value, "El descuento");
  });
  take(["itbisTotal", "itbis_total", "itbis"], (value) => {
    campos.itbisTotal = requireMoney(value, "El ITBIS");
  });
  take(["otrosCargos", "otros_cargos", "otros"], (value) => {
    campos.otrosCargos = requireMoney(value, "Los otros cargos");
  });
  take(["total"], (value) => {
    campos.total = requireMoney(value, "El total");
  });
  const estadoExplicito = hasKey(body, ["estado"]);
  if (estadoExplicito) {
    const estado = parseEstado(pick(body, ["estado"]));
    if (!estado) {
      throw new Error(mensajeEstadoInvalido());
    }
    campos.estado = estado;
  }
  take(["observaciones"], (value) => {
    campos.observaciones = textOrNull(value, 4000);
  });
  take(["facturaOrigenId", "facturaOrigen", "factura_origen_id"], (value) => {
    campos.facturaOrigen = textOrNull(value, 80);
  });

  if (mode === "create") {
    campos.tipoDocumento = campos.tipoDocumento ?? "factura";
    campos.moneda = campos.moneda ?? "DOP";
    campos.estado = campos.estado ?? "recibida";
  }
  return { campos, estadoExplicito };
}

function unirObservacion(propia: string | null, aviso: string | null): string | null {
  if (!aviso) {
    return propia;
  }
  if (!propia) {
    return aviso;
  }
  if (propia.includes(aviso)) {
    return propia;
  }
  return `${propia} ${aviso}`;
}

export function leerCatalogoRef(raw: Record<string, unknown>, donde: string): FacturaCatalogoRef {
  const idKeys = ["productoId", "producto_id", "catalogoId"];
  const codeKeys = ["codigoOdoo", "codigo_odoo", "codigoCatalogo", "codigo_catalogo"];
  const hasId = idKeys.some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  const hasCode = codeKeys.some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (!hasId && !hasCode) {
    return { accion: "omitir" };
  }
  if (hasId) {
    const value = pick(raw, idKeys);
    if (value == null || value === "") {
      return { accion: "quitar" };
    }
    if (typeof value !== "string" || !isUuid(value.trim())) {
      throw new Error(`${donde}: productoId tiene que ser el id del producto en el catálogo`);
    }
    return { accion: "id", id: value.trim() };
  }
  const value = pick(raw, codeKeys);
  if (value == null || value === "") {
    return { accion: "quitar" };
  }
  const codigo = textOrNull(value, 80);
  if (!codigo) {
    return { accion: "quitar" };
  }
  return { accion: "codigo", codigo };
}

export function leerLinea(raw: Record<string, unknown>, index: number): FacturaLineaInput {
  const donde = `La línea ${index + 1}`;
  const numeroRaw = pick(raw, ["numeroLinea", "numero_linea", "numero", "linea"]);
  let numeroLinea = index + 1;
  if (numeroRaw != null && numeroRaw !== "") {
    const numero = typeof numeroRaw === "number" ? numeroRaw : Number(String(numeroRaw).trim());
    if (!Number.isInteger(numero) || numero < 1 || numero > 500) {
      throw new Error(`${donde} tiene un número de línea inválido`);
    }
    numeroLinea = numero;
  }
  const descripcionOriginal = textOrNull(pick(raw, ["descripcionOriginal", "descripcion_original", "descripcion", "texto"]), 500);
  const codigoSku = textOrNull(pick(raw, ["codigoSku", "codigo_sku", "codigo", "sku"]), 80);
  if (!descripcionOriginal && !codigoSku) {
    throw new Error(`${donde} necesita la descripción original o el código`);
  }
  const presentacionRaw = pick(raw, ["presentacion", "presentacionCompra", "presentacion_compra"]);
  const presentacion = presentacionRaw == null || presentacionRaw === "" ? null : parsePresentacion(presentacionRaw);
  if (presentacionRaw != null && presentacionRaw !== "" && !presentacion) {
    throw new Error(`${donde} tiene una presentación inválida. Usa unidad, paquete, caja, fardo u otro`);
  }
  let unidades: ReturnType<typeof resolverUnidades>;
  try {
    unidades = resolverUnidades({
      presentacion,
      cantidadComprada: requireCantidad(pick(raw, ["cantidadComprada", "cantidad_comprada", "cantidad"]), `${donde}: la cantidad`),
      unidadesPorPresentacion: requireCantidad(
        pick(raw, ["unidadesPorPresentacion", "unidades_por_presentacion", "unidadesPorCaja", "unidadesPresentacion"]),
        `${donde}: las unidades por empaque`
      ),
      unidadesTotales: requireCantidad(pick(raw, ["unidadesTotales", "unidades_totales", "unidades"]), `${donde}: las unidades totales`),
      costoPorPresentacion: requireMoney(pick(raw, ["costoPorPresentacion", "costo_por_presentacion", "costo", "costoPresentacion"]), `${donde}: el costo`),
      costoUnitario: requireMoney(pick(raw, ["costoUnitario", "costo_unitario", "costoUnidad"]), `${donde}: el costo unitario`),
    });
  } catch (error) {
    if (error instanceof Error && error.message === LINEA_SIN_EMPAQUE) {
      throw new Error(`${donde}: ${error.message}`);
    }
    throw error;
  }
  const estadoRaw = pick(raw, ["estadoLinea", "estado_linea", "estado"]);
  const estado = estadoRaw == null || estadoRaw === "" ? "pendiente" : parseEstadoLinea(estadoRaw);
  if (!estado) {
    throw new Error(`${donde} tiene un estado inválido. Usa completa, ambigua, ilegible o pendiente`);
  }
  const itbisRaw = pick(raw, ["precioIncluyeItbis", "precio_incluye_itbis", "incluyeItbis"]);
  const precioIncluyeItbis = itbisRaw == null || itbisRaw === "" ? "no_determinado" : parseItbisLinea(itbisRaw);
  if (!precioIncluyeItbis) {
    throw new Error(`${donde}: precioIncluyeItbis tiene que ser si, no o no_determinado`);
  }
  return {
    numeroLinea,
    codigoSku,
    codigoBarras: textOrNull(pick(raw, ["codigoBarras", "codigo_barras", "barras", "ean"]), 40),
    descripcionOriginal,
    productoNormalizado: textOrNull(pick(raw, ["productoNormalizado", "producto_normalizado", "producto", "nombreNormalizado"]), 200),
    marca: textOrNull(pick(raw, ["marca"]), 120),
    variante: textOrNull(pick(raw, ["variante"]), 120),
    tamano: textOrNull(pick(raw, ["tamano", "tamaño", "size"]), 80),
    presentacion,
    cantidadComprada: requireCantidad(pick(raw, ["cantidadComprada", "cantidad_comprada", "cantidad"]), `${donde}: la cantidad`),
    unidadesPorPresentacion: unidades.unidadesPorPresentacion,
    unidadesTotales: unidades.unidadesTotales,
    costoPorPresentacion: requireMoney(pick(raw, ["costoPorPresentacion", "costo_por_presentacion", "costo", "costoPresentacion"]), `${donde}: el costo`),
    costoUnitario: unidades.costoUnitario,
    descuentoLinea: requireMoney(pick(raw, ["descuentoLinea", "descuento_linea", "descuento"]), `${donde}: el descuento`),
    itbisLinea: requireMoney(pick(raw, ["itbisLinea", "itbis_linea", "itbis"]), `${donde}: el ITBIS`),
    precioIncluyeItbis,
    subtotalLinea: requireMoney(pick(raw, ["subtotalLinea", "subtotal_linea", "subtotal"]), `${donde}: el subtotal`),
    totalLinea: requireMoney(pick(raw, ["totalLinea", "total_linea", "total"]), `${donde}: el total`),
    estado,
    observacion: unirObservacion(textOrNull(pick(raw, ["observacion", "observaciones"]), 1000), unidades.aviso),
    catalogo: leerCatalogoRef(raw, donde),
  };
}

export function leerLineas(value: unknown): FacturaLineaInput[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Las líneas tienen que ser una lista");
  }
  const lineas = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`La línea ${index + 1} tiene que ser un objeto`);
    }
    return leerLinea(item as Record<string, unknown>, index);
  });
  const numeros = new Set<number>();
  for (const linea of lineas) {
    if (numeros.has(linea.numeroLinea)) {
      throw new Error(`La línea ${linea.numeroLinea} está repetida`);
    }
    numeros.add(linea.numeroLinea);
  }
  return lineas;
}

export function leerValidacion(raw: Record<string, unknown>, index: number): FacturaValidacionInput {
  const codigo = parseValidacionCodigo(pick(raw, ["codigo", "id", "validacion"]));
  if (!codigo) {
    throw new Error(`La validación ${index + 1} no tiene un codigo conocido`);
  }
  const resultadoRaw = pick(raw, ["resultado"]);
  const resultado = resultadoRaw == null || resultadoRaw === "" ? "pendiente" : parseResultado(resultadoRaw);
  if (!resultado) {
    throw new Error(`La validación ${labelOf(FACTURA_VALIDACIONES, codigo)} tiene un resultado inválido. Usa correcto, diferencia, pendiente o no_aplica`);
  }
  return {
    codigo,
    resultado,
    explicacion: textOrNull(pick(raw, ["explicacion", "explicación", "detalle"]), 2000),
    revisadoEn: requireFechaHora(pick(raw, ["revisadoEn", "revisado_en", "fecha"]), "La fecha de revisión"),
  };
}

export function leerValidaciones(value: unknown): FacturaValidacionInput[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Las validaciones tienen que ser una lista");
  }
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`La validación ${index + 1} tiene que ser un objeto`);
    }
    const validacion = leerValidacion(item as Record<string, unknown>, index);
    if (seen.has(validacion.codigo)) {
      throw new Error(`La validación ${labelOf(FACTURA_VALIDACIONES, validacion.codigo)} está repetida`);
    }
    seen.add(validacion.codigo);
    return validacion;
  });
}

export function leerPregunta(raw: Record<string, unknown>, index: number): FacturaPreguntaInput {
  const pregunta = textOrNull(pick(raw, ["pregunta"]), 2000);
  if (!pregunta) {
    throw new Error(`La pregunta ${index + 1} está vacía`);
  }
  const respuesta = textOrNull(pick(raw, ["respuesta"]), 4000);
  const estadoRaw = pick(raw, ["estado"]);
  let estado: FacturaPreguntaEstado;
  if (estadoRaw == null || estadoRaw === "") {
    estado = respuesta ? "resuelta" : "abierta";
  } else {
    const parsed = parsePreguntaEstado(estadoRaw);
    if (!parsed) {
      throw new Error(`La pregunta ${index + 1} tiene un estado inválido. Usa abierta o resuelta`);
    }
    estado = parsed;
  }
  const lineaRaw = pick(raw, ["lineaNumero", "linea_numero", "numeroLinea"]);
  let lineaNumero: number | null = null;
  if (lineaRaw != null && lineaRaw !== "") {
    const numero = typeof lineaRaw === "number" ? lineaRaw : Number(String(lineaRaw).trim());
    if (!Number.isInteger(numero) || numero < 1) {
      throw new Error(`La pregunta ${index + 1} apunta a una línea inválida`);
    }
    lineaNumero = numero;
  }
  const idRaw = pick(raw, ["id", "preguntaId"]);
  const id = typeof idRaw === "string" && isUuid(idRaw.trim()) ? idRaw.trim() : null;
  return {
    id,
    lineaNumero,
    campo: textOrNull(pick(raw, ["campo", "producto"]), 200),
    pregunta,
    consultadoA: textOrNull(pick(raw, ["consultadoA", "consultado_a", "consultado"]), 160),
    respuesta,
    respondidoPor: textOrNull(pick(raw, ["respondidoPor", "respondido_por"]), 160),
    respondidoEn: requireFechaHora(pick(raw, ["respondidoEn", "respondido_en"]), "La fecha de respuesta"),
    evidencia: textOrNull(pick(raw, ["evidencia"]), 2000),
    estado,
  };
}

export function leerPreguntas(value: unknown): FacturaPreguntaInput[] {
  if (value == null) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`La pregunta ${index + 1} tiene que ser un objeto`);
    }
    return leerPregunta(item as Record<string, unknown>, index);
  });
}

export function facturaTieneIdentidad(campos: FacturaCampos, lineas: number, documentos: number): boolean {
  return Boolean(campos.proveedor || campos.ncf || campos.numeroFactura || campos.tienda || lineas > 0 || documentos > 0);
}

export type FacturaRespuestaInput = {
  respuesta: string;
  respondidoPor: string | null;
  evidencia: string | null;
  estado: FacturaPreguntaEstado;
  respondidoEn: string;
};

export function leerRespuestaPregunta(body: Record<string, unknown>): FacturaRespuestaInput {
  const respuesta = textOrNull(pick(body, ["respuesta"]), 4000);
  if (!respuesta) {
    throw new Error("La respuesta está vacía");
  }
  const estadoRaw = pick(body, ["estado"]);
  const estado = estadoRaw == null || estadoRaw === "" ? "resuelta" : parsePreguntaEstado(estadoRaw);
  if (!estado) {
    throw new Error("El estado de la pregunta tiene que ser abierta o resuelta");
  }
  const respondidoEn = requireFechaHora(pick(body, ["respondidoEn", "respondido_en"]), "La fecha de respuesta") ?? new Date().toISOString();
  return {
    respuesta,
    respondidoPor: textOrNull(pick(body, ["respondidoPor", "respondido_por"]), 160),
    evidencia: textOrNull(pick(body, ["evidencia"]), 2000),
    estado,
    respondidoEn,
  };
}

/** Hace falta este historial mínimo para avisar. */
export const ALERTA_MIN_COMPRAS = 3;
/** Cuántas compras anteriores entran en la mediana. */
export const ALERTA_HISTORIAL = 6;
export const ALERTA_PRECIO_DEFECTO = 0.15;
export const ALERTA_CANTIDAD_DEFECTO = 0.5;

export function mediana(valores: number[]): number | null {
  const ordenados = valores.filter((valor) => Number.isFinite(valor)).sort((a, b) => a - b);
  if (!ordenados.length) {
    return null;
  }
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[medio] : (ordenados[medio - 1] + ordenados[medio]) / 2;
}

export type MedidaLinea = { clave: string; medida: "unidad" | "presentacion"; costo: number | null; cantidad: number | null };

/** Qué se compara: costo por unidad si se conoce; si no, costo por presentación de la misma presentación y tamaño. */
export function medidaLinea(linea: {
  costoUnitario: number | null;
  unidadesTotales: number | null;
  costoPorPresentacion: number | null;
  cantidadComprada: number | null;
  presentacion: string | null;
  unidadesPorPresentacion: number | null;
}): MedidaLinea | null {
  if (linea.costoUnitario != null && linea.costoUnitario > 0) {
    return { clave: "unidad", medida: "unidad", costo: linea.costoUnitario, cantidad: linea.unidadesTotales };
  }
  if (linea.costoPorPresentacion != null && linea.costoPorPresentacion > 0) {
    return {
      clave: `presentacion:${linea.presentacion ?? "?"}:${linea.unidadesPorPresentacion ?? "?"}`,
      medida: "presentacion",
      costo: linea.costoPorPresentacion,
      cantidad: linea.cantidadComprada,
    };
  }
  return null;
}

function porcentaje(variacion: number): string {
  return `${Math.round(Math.abs(variacion) * 100)}%`;
}

/**
 * Compara la línea con la mediana de las últimas compras (historial ya filtrado al mismo producto y proveedor,
 * la más reciente primero). Avisa si se sale más que el umbral, hacia arriba o hacia abajo.
 */
export function alertasLinea(
  actual: MedidaLinea | null,
  historial: Array<MedidaLinea | null>,
  umbral: { precio: number; cantidad: number },
  moneda: FacturaMoneda = "DOP"
): FacturaLineaAlerta[] {
  if (!actual) {
    return [];
  }
  const previas = historial.filter((item): item is MedidaLinea => Boolean(item && item.clave === actual.clave)).slice(0, ALERTA_HISTORIAL);
  const alertas: FacturaLineaAlerta[] = [];
  const costos = previas.map((item) => item.costo).filter((valor): valor is number => valor != null && valor > 0);
  const medianaCosto = costos.length >= ALERTA_MIN_COMPRAS ? mediana(costos) : null;
  if (actual.costo != null && medianaCosto) {
    const variacion = roundTo((actual.costo - medianaCosto) / medianaCosto, 4);
    if (Math.abs(variacion) > umbral.precio) {
      alertas.push({
        tipo: "precio",
        valor: actual.costo,
        mediana: roundTo(medianaCosto, 2),
        variacion,
        compras: costos.length,
        medida: actual.medida,
        texto: `Precio ${porcentaje(variacion)} ${variacion > 0 ? "más alto" : "más bajo"} que lo normal: ${formatMonto(medianaCosto, moneda)} ${actual.medida === "unidad" ? "por unidad" : "por presentación"} en las últimas ${costos.length} compras.`,
      });
    }
  }
  const cantidades = previas.map((item) => item.cantidad).filter((valor): valor is number => valor != null && valor > 0);
  const medianaCantidad = cantidades.length >= ALERTA_MIN_COMPRAS ? mediana(cantidades) : null;
  if (actual.cantidad != null && actual.cantidad > 0 && medianaCantidad) {
    const variacion = roundTo((actual.cantidad - medianaCantidad) / medianaCantidad, 4);
    if (Math.abs(variacion) > umbral.cantidad) {
      alertas.push({
        tipo: "cantidad",
        valor: actual.cantidad,
        mediana: roundTo(medianaCantidad, 2),
        variacion,
        compras: cantidades.length,
        medida: actual.medida,
        texto: `Cantidad ${porcentaje(variacion)} ${variacion > 0 ? "mayor" : "menor"} que lo normal: ${medianaCantidad} ${actual.medida === "unidad" ? "unidades" : "presentaciones"} en las últimas ${cantidades.length} compras.`,
      });
    }
  }
  return alertas;
}
