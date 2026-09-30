"use client";

import { ITBIS_PORCIENTO } from "@/lib/pos";
import { ticketPreview, type TicketSale } from "@/lib/pos-print";

export function PosTicketPreview({ sale }: { sale: TicketSale }) {
  const ticket = ticketPreview(sale);
  return (
    <article
      className="mx-auto w-full max-w-[280px] rounded-sm bg-white px-4 py-4 text-left font-mono text-[13px] leading-snug text-black shadow-md"
      aria-label="Vista previa del ticket"
    >
      <p className="text-center text-lg font-extrabold tracking-wide">QUICK!</p>
      <p className="text-center">Mini Market</p>
      <p className="mt-2">{ticket.when}</p>
      {ticket.cajero ? <p>Cajero: {ticket.cajero}</p> : null}
      <p className="my-2 border-t border-dashed border-black" />
      <ul className="space-y-2">
        {ticket.lines.map((line, index) => (
          <li key={`${line.nombre}-${index}`}>
            <div className="flex justify-between gap-3">
              <span className="min-w-0">{line.nombre}</span>
              <span className="shrink-0 tabular-nums">{line.importe}</span>
            </div>
            <p>{line.detalle}</p>
            {line.descuento ? <p>{line.descuento}</p> : null}
          </li>
        ))}
      </ul>
      <p className="my-2 border-t border-dashed border-black" />
      {ticket.descuento ? (
        <p className="flex justify-between gap-3">
          <span>Descuento</span>
          <span className="tabular-nums">{ticket.descuento}</span>
        </p>
      ) : null}
      {ticket.quickcoins ? (
        <p className="flex justify-between gap-3">
          <span>QuickCoins</span>
          <span className="tabular-nums">{ticket.quickcoins}</span>
        </p>
      ) : null}
      <p className="flex justify-between gap-3">
        <span>Base</span>
        <span className="tabular-nums">{ticket.base}</span>
      </p>
      <p className="flex justify-between gap-3">
        <span>ITBIS {ITBIS_PORCIENTO}%</span>
        <span className="tabular-nums">{ticket.itbis}</span>
      </p>
      <p className="text-[11px]">Precios con ITBIS incluido</p>
      <p className="mt-1 flex justify-between gap-3 text-base font-extrabold">
        <span>TOTAL</span>
        <span className="tabular-nums">{ticket.total}</span>
      </p>
      <p className="mt-2">{ticket.metodo}</p>
      {ticket.recibido ? <p>Recibido {ticket.recibido}</p> : null}
      {ticket.cambio ? <p>Cambio {ticket.cambio}</p> : null}
      {ticket.ganar ? <p>{ticket.ganar}</p> : null}
      <p className="mt-3 text-center">Gracias por tu compra</p>
    </article>
  );
}
