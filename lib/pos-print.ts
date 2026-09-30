import { formatPrice } from "@/lib/money";
import { ITBIS_PORCIENTO, metodoPagoLabel, splitItbis } from "@/lib/pos";

export type TicketSale = {
  createdAt: string;
  total: number;
  items: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    precioLista?: number;
    descuento?: number;
  }>;
  descuentoTotal?: number;
  quickcoins?: { descuentoCanje?: number; ganarPuntos?: number } | null;
  metodoPago: string;
  montoRecibido: number | null;
  cambio: number | null;
  cajero?: string | null;
};

const STORAGE_KEY = "quick-pos-printer";

type PrinterKind = "usb" | "serial";

type UsbEndpoint = { direction: string; endpointNumber: number };
type UsbInterface = { interfaceNumber: number; alternate: { endpoints: UsbEndpoint[] } };
type UsbDeviceLike = {
  opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  open: () => Promise<void>;
  selectConfiguration: (configurationValue: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<unknown>;
};
type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  writable: { getWriter: () => { write: (data: Uint8Array) => Promise<void>; releaseLock: () => void } } | null;
};

function usbApi(): { getDevices: () => Promise<UsbDeviceLike[]>; requestDevice: (options: { filters: unknown[] }) => Promise<UsbDeviceLike> } | null {
  const usb = (navigator as Navigator & { usb?: { getDevices: () => Promise<UsbDeviceLike[]>; requestDevice: (options: { filters: unknown[] }) => Promise<UsbDeviceLike> } }).usb;
  return usb ?? null;
}

function serialApi(): { getPorts: () => Promise<SerialPortLike[]>; requestPort: () => Promise<SerialPortLike> } | null {
  const serial = (navigator as Navigator & { serial?: { getPorts: () => Promise<SerialPortLike[]>; requestPort: () => Promise<SerialPortLike> } }).serial;
  return serial ?? null;
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function pushText(bytes: number[], value: string): void {
  const encoded = new TextEncoder().encode(stripAccents(value));
  for (let index = 0; index < encoded.length; index += 1) {
    bytes.push(encoded[index]);
  }
}

function line(bytes: number[], value = ""): void {
  pushText(bytes, value);
  bytes.push(0x0a);
}

export type TicketPreview = {
  when: string;
  cajero: string | null;
  lines: Array<{ nombre: string; detalle: string; descuento: string | null; importe: string }>;
  descuento: string | null;
  quickcoins: string | null;
  base: string;
  itbis: string;
  total: string;
  metodo: string;
  recibido: string | null;
  cambio: string | null;
  ganar: string | null;
};

export function ticketPreview(sale: TicketSale): TicketPreview {
  const when = new Date(sale.createdAt);
  const tax = splitItbis(sale.total);
  return {
    when: Number.isNaN(when.getTime()) ? sale.createdAt : when.toLocaleString("es-DO"),
    cajero: sale.cajero ?? null,
    lines: sale.items.map((item) => ({
      nombre: item.nombre,
      detalle: `${item.cantidad} x ${formatPrice(item.precioLista ?? item.precioUnitario)}`,
      descuento: (item.descuento ?? 0) > 0 ? `Desc. -${formatPrice(item.descuento ?? 0)}` : null,
      importe: formatPrice(item.precioUnitario * item.cantidad),
    })),
    descuento: (sale.descuentoTotal ?? 0) > 0 ? `-${formatPrice(sale.descuentoTotal ?? 0)}` : null,
    quickcoins: (sale.quickcoins?.descuentoCanje ?? 0) > 0 ? `-${formatPrice(sale.quickcoins?.descuentoCanje ?? 0)}` : null,
    base: formatPrice(tax.base),
    itbis: formatPrice(tax.itbis),
    total: formatPrice(tax.total),
    metodo: metodoPagoLabel(sale.metodoPago),
    recibido: sale.montoRecibido == null ? null : formatPrice(sale.montoRecibido),
    cambio: sale.cambio == null ? null : formatPrice(sale.cambio),
    ganar: (sale.quickcoins?.ganarPuntos ?? 0) > 0 ? `Ganaste ${sale.quickcoins?.ganarPuntos} QuickCoins` : null,
  };
}

export function buildEscPosTicket(sale: TicketSale, openDrawer: boolean): Uint8Array {
  const bytes: number[] = [];
  bytes.push(0x1b, 0x40);
  bytes.push(0x1b, 0x61, 0x01);
  bytes.push(0x1b, 0x45, 0x01);
  line(bytes, "QUICK!");
  bytes.push(0x1b, 0x45, 0x00);
  line(bytes, "Mini Market");
  line(bytes);
  bytes.push(0x1b, 0x61, 0x00);
  const when = new Date(sale.createdAt);
  line(bytes, Number.isNaN(when.getTime()) ? sale.createdAt : when.toLocaleString("es-DO"));
  if (sale.cajero) line(bytes, `Cajero: ${sale.cajero}`);
  line(bytes, "--------------------------------");
  for (const item of sale.items) {
    const qty = `${item.cantidad} x ${formatPrice(item.precioLista ?? item.precioUnitario)}`;
    line(bytes, item.nombre.slice(0, 32));
    line(bytes, `  ${qty}`);
    if ((item.descuento ?? 0) > 0) line(bytes, `  Desc. -${formatPrice(item.descuento ?? 0)}`);
  }
  line(bytes, "--------------------------------");
  if ((sale.descuentoTotal ?? 0) > 0) line(bytes, `Descuento: -${formatPrice(sale.descuentoTotal ?? 0)}`);
  if ((sale.quickcoins?.descuentoCanje ?? 0) > 0) {
    line(bytes, `QuickCoins: -${formatPrice(sale.quickcoins?.descuentoCanje ?? 0)}`);
  }
  const tax = splitItbis(sale.total);
  line(bytes, `Base: ${formatPrice(tax.base)}`);
  line(bytes, `ITBIS ${ITBIS_PORCIENTO}%: ${formatPrice(tax.itbis)}`);
  line(bytes, "Precios con ITBIS incluido");
  bytes.push(0x1b, 0x45, 0x01);
  line(bytes, `TOTAL ${formatPrice(tax.total)}`);
  bytes.push(0x1b, 0x45, 0x00);
  line(bytes, metodoPagoLabel(sale.metodoPago));
  if (sale.montoRecibido != null) line(bytes, `Recibido ${formatPrice(sale.montoRecibido)}`);
  if (sale.cambio != null) line(bytes, `Cambio ${formatPrice(sale.cambio)}`);
  if ((sale.quickcoins?.ganarPuntos ?? 0) > 0) line(bytes, `Ganaste ${sale.quickcoins?.ganarPuntos} QuickCoins`);
  line(bytes);
  line(bytes, "Gracias por tu compra");
  line(bytes);
  if (openDrawer) bytes.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
  bytes.push(0x1d, 0x56, 0x41, 0x10);
  return Uint8Array.from(bytes);
}

async function writeUsb(device: UsbDeviceLike, payload: Uint8Array): Promise<void> {
  if (!device.opened) await device.open();
  if (!device.configuration) await device.selectConfiguration(1);
  const iface = device.configuration?.interfaces[0];
  if (!iface) throw new Error("La impresora no tiene una interfaz");
  await device.claimInterface(iface.interfaceNumber);
  const endpoint = iface.alternate.endpoints.find((item) => item.direction === "out");
  if (!endpoint) throw new Error("La impresora no acepta datos");
  await device.transferOut(endpoint.endpointNumber, payload as BufferSource);
}

async function writeSerial(port: SerialPortLike, payload: Uint8Array): Promise<void> {
  await port.open({ baudRate: 9600 });
  const writer = port.writable?.getWriter();
  if (!writer) throw new Error("No se pudo escribir en la impresora");
  await writer.write(payload);
  writer.releaseLock();
}

export async function printPosTicket(
  sale: TicketSale,
  options: { openDrawer: boolean; request: boolean }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload = buildEscPosTicket(sale, options.openDrawer);
  const saved = (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null) as PrinterKind | null;
  const usb = usbApi();
  const serial = serialApi();
  try {
    if ((saved === "usb" || !saved) && usb) {
      let devices = await usb.getDevices();
      if (devices.length === 0 && options.request) {
        devices = [await usb.requestDevice({ filters: [] })];
        localStorage.setItem(STORAGE_KEY, "usb");
      }
      if (devices[0]) {
        await writeUsb(devices[0], payload);
        localStorage.setItem(STORAGE_KEY, "usb");
        return { ok: true };
      }
    }
    if ((saved === "serial" || !saved) && serial) {
      let ports = await serial.getPorts();
      if (ports.length === 0 && options.request) {
        ports = [await serial.requestPort()];
        localStorage.setItem(STORAGE_KEY, "serial");
      }
      if (ports[0]) {
        await writeSerial(ports[0], payload);
        localStorage.setItem(STORAGE_KEY, "serial");
        return { ok: true };
      }
    }
    return { ok: false, message: "Conecta la impresora para el ticket" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos imprimir";
    return { ok: false, message };
  }
}

export function printTicketInBrowser(sale: TicketSale): void {
  const preview = ticketPreview(sale);
  const rows = preview.lines
    .map(
      (item) =>
        `<tr><td>${item.detalle}<br>${item.nombre}${item.descuento ? `<br>${item.descuento}` : ""}</td><td>${item.importe}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><title>Ticket</title><style>
    body{font-family:ui-monospace,monospace;width:280px;margin:0 auto}
    table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top}
    td:last-child{text-align:right}
    h1{font-size:20px;text-align:center;margin:0}
  </style></head><body>
    <h1>QUICK!</h1>
    <p style="text-align:center">Mini Market</p>
    <p>${preview.when}${preview.cajero ? `<br>Cajero: ${preview.cajero}` : ""}</p>
    <table>${rows}</table>
    ${preview.descuento ? `<p>Descuento ${preview.descuento}</p>` : ""}
    ${preview.quickcoins ? `<p>QuickCoins ${preview.quickcoins}</p>` : ""}
    <p>Base ${preview.base}<br>ITBIS ${ITBIS_PORCIENTO}% ${preview.itbis}<br>Precios con ITBIS incluido</p>
    <p><strong>Total ${preview.total}</strong></p>
    <p>${preview.metodo}</p>
    ${preview.recibido ? `<p>Recibido ${preview.recibido}</p>` : ""}
    ${preview.cambio ? `<p>Cambio ${preview.cambio}</p>` : ""}
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;
  const popup = window.open("", "ticket", "width=420,height=720");
  if (!popup) return;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
