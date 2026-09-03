"use client";

import { FormEvent, useState } from "react";
import { whatsappHref } from "@/lib/theme";

export function ExpansionForm() {
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lines = [
      "Hola! Quiero proponer un espacio para Quick! Mini Market.",
      `Tipo de oportunidad: ${data.get("opportunity") || "-"}`,
      `Nombre: ${data.get("firstName") || ""} ${data.get("lastName") || ""}`.trim(),
      `Empresa: ${data.get("company") || "-"}`,
      `Teléfono: ${data.get("phone") || "-"}`,
      `Email: ${data.get("email") || "-"}`,
      `Cantidad de espacios: ${data.get("siteCount") || "-"}`,
      `Tipo de espacio: ${data.get("siteType") || "-"}`,
      `Información del espacio: ${data.get("details") || "-"}`,
    ];
    window.open(
      `${whatsappHref()}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSent(true);
  }

  if (sent) {
    return (
      <p className="hint" role="status">
        Gracias. Te redirigimos a WhatsApp para enviar la propuesta. Si no se abrió, vuelve a
        intentar.
      </p>
    );
  }

  return (
    <form className="lead-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="form-field form-field-full">
          <label htmlFor="opportunity">Tipo de oportunidad</label>
          <select id="opportunity" name="opportunity" required defaultValue="">
            <option value="" disabled>
              Selecciona
            </option>
            <option value="Alquiler">Alquiler</option>
            <option value="Venta">Venta</option>
            <option value="Alianza">Alianza con el residencial</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="firstName">Nombre</label>
          <input id="firstName" name="firstName" type="text" required autoComplete="given-name" />
        </div>
        <div className="form-field">
          <label htmlFor="lastName">Apellido</label>
          <input id="lastName" name="lastName" type="text" required autoComplete="family-name" />
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="company">Empresa o residencial (si aplica)</label>
          <input id="company" name="company" type="text" autoComplete="organization" />
        </div>

        <div className="form-field">
          <label htmlFor="phone">Teléfono</label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" />
        </div>
        <div className="form-field">
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <div className="form-field form-field-full">
          <label>Cantidad de espacios</label>
          <div className="radio-row">
            <label className="radio-option">
              <input type="radio" name="siteCount" value="1" required />
              1
            </label>
            <label className="radio-option">
              <input type="radio" name="siteCount" value="2-10" />
              2-10
            </label>
            <label className="radio-option">
              <input type="radio" name="siteCount" value="10+" />
              10+
            </label>
          </div>
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="siteType">Tipo de espacio</label>
          <select id="siteType" name="siteType" required defaultValue="">
            <option value="" disabled>
              Selecciona
            </option>
            <option value="Local en residencial">Local en residencial</option>
            <option value="Plaza comercial">Plaza comercial</option>
            <option value="Local independiente">Local independiente</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="details">Información del espacio</label>
          <textarea
            id="details"
            name="details"
            required
            placeholder="Nombre del residencial, ubicación, tamaño del local, visibilidad, parqueo y cualquier restricción conocida."
          />
          <p className="hint">
            Incluye lo que ayude a evaluar el espacio: tamaño, año de construcción o última
            renovación, y si hay restricciones.
          </p>
        </div>

        <div className="form-field form-field-full">
          <label className="checkbox-row">
            <input type="checkbox" name="disclaimer" required />
            <span>
              Acepto que Quick! Mini Market se comunique conmigo para evaluar esta propuesta.
            </span>
          </label>
        </div>

        <div className="form-field form-field-full">
          <button className="submit-btn" type="submit">
            Enviar
          </button>
        </div>
      </div>
    </form>
  );
}
