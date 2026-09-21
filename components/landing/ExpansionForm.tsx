"use client";

import { FormEvent, useState } from "react";
import { BrandButton } from "@/components/landing/BrandUi";
import { whatsappHref } from "@/lib/theme";

const FIELD_CLASS =
  "mt-1.5 w-full rounded-[14px] border border-black/[0.12] bg-white px-3.5 py-3 text-base text-[#1A1A1A] outline-none transition focus:border-[#7EB341]";

export function ExpansionForm() {
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lines = [
      "Hola! Quiero proponer un espacio para Quick! Mini Market.",
      `Nombre: ${data.get("name") || "-"}`,
      `Empresa o residencial: ${data.get("company") || "-"}`,
      `Teléfono: ${data.get("phone") || "-"}`,
      `Email: ${data.get("email") || "-"}`,
      `Información del espacio: ${data.get("details") || "-"}`,
    ];
    window.open(
      `${whatsappHref()}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-[18px] sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold text-[#123B7A]">Nombre</span>
          <input className={FIELD_CLASS} name="name" type="text" required autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[#123B7A]">Empresa o residencial</span>
          <input className={FIELD_CLASS} name="company" type="text" autoComplete="organization" />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[#123B7A]">Teléfono</span>
          <input className={FIELD_CLASS} name="phone" type="tel" required autoComplete="tel" />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[#123B7A]">Correo electrónico</span>
          <input className={FIELD_CLASS} name="email" type="email" required autoComplete="email" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-bold text-[#123B7A]">Información del espacio</span>
          <textarea
            className={`${FIELD_CLASS} min-h-[120px] resize-y`}
            name="details"
            rows={4}
            required
            placeholder="Ubicación, tamaño del local, visibilidad, parqueo y restricciones."
          />
        </label>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <BrandButton type="submit" variant="green">
          Enviar
        </BrandButton>
        <BrandButton href={whatsappHref()} variant="outline">
          Escribir por WhatsApp
        </BrandButton>
      </div>
      {sent ? (
        <p className="mt-5 rounded-[18px] bg-[#F1F7EA] px-5 py-4 text-[15px] text-[#123B7A]" role="status">
          Gracias. Te contactamos por WhatsApp o correo para revisar la propuesta.
        </p>
      ) : null}
    </form>
  );
}
