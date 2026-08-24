import type { OrderAgingLevel } from "@/lib/order-aging";
import type { OrderEstado } from "@/lib/types";

export const SUPERVISION_REFRESH_MS = 30_000;
export const SUPERVISION_STUCK_AFTER_MINUTES = 15;

export type SupervisionResumen = {
  nuevosSinAtender: number;
  enProceso: number;
  despachadosHoy: number;
  completadosHoy: number;
  canceladosHoy: number;
};

export type SupervisionPedidoActivo = {
  id: string;
  numero: string;
  clienteNombre: string | null;
  clienteTelefono: string;
  direccion: string;
  estado: OrderEstado;
  totalEstimado: number;
  createdAt: string;
  updatedAt: string;
  agingLevel: OrderAgingLevel;
};

export type SupervisionAlertaEstancado = {
  id: string;
  numero: string;
  clienteNombre: string | null;
  clienteTelefono: string;
  estado: OrderEstado;
  updatedAt: string;
  minutosSinAvance: number;
};

export type SupervisionMetricasDia = {
  pedidosCreadosHoy: number;
  ticketPromedio: number;
  tiempoPromedioDespachoMinutos: number | null;
  tasaCancelacion: number;
};

export type SupervisionData = {
  generatedAt: string;
  resumen: SupervisionResumen;
  cola: SupervisionPedidoActivo[];
  estancados: SupervisionAlertaEstancado[];
  metricas: SupervisionMetricasDia;
};
