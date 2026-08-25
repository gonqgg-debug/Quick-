export const WHATSAPP_TEXT_MAX = 4096;
export const MASS_MESSAGE_PAUSE_MS = 250;

export type MassMessageFilter = {
  ultimoPedidoDesde: string | null;
  ultimoPedidoHasta: string | null;
};

export type MassMessagePreview = {
  count: number;
  totalMarketing: number;
};

export type MassMessageProgressEvent =
  | { type: "start"; total: number }
  | { type: "progress"; sent: number; failed: number; skipped: number; total: number }
  | { type: "done"; sent: number; failed: number; skipped: number; total: number }
  | { type: "error"; error: string };
