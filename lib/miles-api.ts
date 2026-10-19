export const MILES_BASE_URL = "https://www.quickminimarket.com";

export const MILES_NOTA_APEX =
  "Usa https://www.quickminimarket.com. https://quickminimarket.com responde 308 hacia www y un cliente que siga ese redirect puede perder el body de un POST o PATCH.";

export const MILES_LIMITES = {
  titulo: 160,
  resumen: 400,
  observacion: 2000,
  interpretacion: 2000,
  recomendacion: 2000,
  prioridadJustificacion: 500,
  idempotencyKey: 120,
} as const;

export const MILES_AGENT_ENDPOINTS = [
  { method: "GET", path: "/api/agent/analytics/coverage", describe: "Cobertura de días, costo y calidad del periodo. No rellena días faltantes con cero." },
  { method: "GET", path: "/api/agent/analytics/summary", describe: "Venta, tickets, ticket, unidades y margen del dashboard. comparacion=semana (también comparar=semana_anterior) corre la ventana un múltiplo de 7: los mismos días de la semana anterior. comparacion=anterior usa el periodo inmediato, con la misma cantidad de días. comparacion=anio usa las mismas fechas del año previo; si ese año no tiene cobertura responde no_disponible o sin_base, sin inventar ceros. El modo resuelto vuelve en filtros.comparacion y la ventana en periodos.comparado." },
  { method: "GET", path: "/api/agent/analytics/products", describe: "Productos del periodo. participacion es sobre la venta con ITBIS del periodo, no de la página." },
  { method: "GET", path: "/api/agent/analytics/hours?reloj=real|caja", describe: "Mapa de horas. real usa la hora de la transacción en America/Santo_Domingo. caja usa el día operativo." },
  { method: "GET", path: "/api/agent/analytics/baskets?a=&b=", describe: "Dos productos: tickets elegibles, con A, con B, con ambos, proporción y fuerza. Muestra pequeña queda marcada." },
  { method: "POST", path: "/api/agent/miles/runs", describe: "Abre una ejecución. idempotencyKey. No acepta agent_id." },
  { method: "GET", path: "/api/agent/miles/runs/{id}", describe: "Lee una corrida por id. Responde 200 con estado, version, datosHasta, corte y error. Hace falta leer version antes de cerrarla." },
  { method: "PATCH", path: "/api/agent/miles/runs/{id}", describe: "Cierra la corrida. Body: { version, estado }. estado acepta completada o fallida. Sin estado, el error pide completada o fallida; no dice que el campo esté prohibido." },
  { method: "GET", path: "/api/agent/miles/findings", describe: "Hallazgos propios. Filtros tienda, tipo, estado, prioridad, desde, hasta. cursor y limit." },
  { method: "POST", path: "/api/agent/miles/findings", describe: "Publica un hallazgo con métricas, evidencia y visual opcional. titulo supera 160 caracteres si se pasa de ahí; un título vacío es «titulo es obligatorio». evidencia.consultas es una lista con un nombre del campo consultas, una ruta /api/agent/analytics/... o una nota que contenga ese nombre. Si no está, el error cita el texto y la lista. visual es un objeto declarativo, sin HTML. La misma idempotencyKey devuelve el mismo hallazgo; otro contenido es 409." },
  { method: "GET", path: "/api/agent/miles/findings/{id}", describe: "Hallazgo, snapshot, historial y comentarios humanos." },
  { method: "PATCH", path: "/api/agent/miles/findings/{id}", describe: "Miles no descarta ni archiva. Solo puede corregir texto propio si la version coincide." },
  { method: "GET", path: "/api/agent/miles/investigations", describe: "Investigaciones y ampliaciones. estado=pendiente son las que nadie ha tomado." },
  { method: "PATCH", path: "/api/agent/miles/investigations/{id}", describe: "Tomar (en_analisis), pedir información o responder. No las crea ni las cancela." },
  { method: "GET", path: "/api/agent/miles/experiments", describe: "Pruebas. estado=pendiente_evaluacion son las que esperan evaluación." },
  { method: "POST", path: "/api/agent/miles/experiments/{id}/evaluations", describe: "Publica una evaluación. No cambia el estado ni la decisión humana." },
  { method: "GET", path: "/api/agent/miles/proposals", describe: "Propuestas de combos y promos, con productos, hallazgos, pruebas y evaluaciones." },
  { method: "POST", path: "/api/agent/miles/proposals", describe: "Publica una propuesta. idempotencyKey. Solo borrador o por_revisar. No activa descuentos." },
  { method: "GET", path: "/api/agent/miles/proposals/{id}", describe: "Propuesta, variantes e historial." },
  { method: "PATCH", path: "/api/agent/miles/proposals/{id}", describe: "Corrige una propuesta propia si la version coincide. No la aprueba, no la descarta y no cambia precios." },
] as const;
