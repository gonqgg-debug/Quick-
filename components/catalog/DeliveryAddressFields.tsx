"use client";

import {
  RESIDENCIAL_OPTIONS,
  isKnownResidencial,
  type AddressDraft,
  type ResidencialOption,
} from "@/lib/customers";
import { brand } from "@/lib/theme";

type DeliveryAddressFieldsProps = {
  value: AddressDraft;
  onChange: (value: AddressDraft) => void;
};

const inputStyle = {
  borderColor: `${brand.muted}40`,
  minHeight: 48,
  fontSize: 16,
} as const;

export function DeliveryAddressFields({ value, onChange }: DeliveryAddressFieldsProps) {
  const known = isKnownResidencial(value.residencial);
  const other = value.residencial === "Otro";

  function patch(partial: Partial<AddressDraft>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-bold text-brand-ink">Complejo residencial</span>
        <select
          value={value.residencial}
          onChange={(event) => {
            const residencial = event.target.value as ResidencialOption | "";
            patch({
              residencial,
              edificio: isKnownResidencial(residencial) ? value.edificio : "",
              apartamento: isKnownResidencial(residencial) ? value.apartamento : "",
              direccionLibre: residencial === "Otro" ? value.direccionLibre : "",
            });
          }}
          className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none"
          style={inputStyle}
        >
          <option value="">Selecciona...</option>
          {RESIDENCIAL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {known ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-bold text-brand-ink">Edificio</span>
            <input
              value={value.edificio}
              onChange={(event) => patch({ edificio: event.target.value })}
              placeholder="4"
              className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none placeholder:text-brand-muted"
              style={inputStyle}
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-brand-ink">Apartamento</span>
            <input
              value={value.apartamento}
              onChange={(event) => patch({ apartamento: event.target.value })}
              placeholder="2B"
              className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none placeholder:text-brand-muted"
              style={inputStyle}
            />
          </label>
        </div>
      ) : null}

      {other ? (
        <label className="block">
          <span className="text-sm font-bold text-brand-ink">Dirección de entrega</span>
          <textarea
            value={value.direccionLibre}
            onChange={(event) => patch({ direccionLibre: event.target.value })}
            rows={3}
            autoComplete="street-address"
            placeholder="Calle, número, piso, referencias..."
            className="mt-2 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-base outline-none placeholder:text-brand-muted"
            style={{ borderColor: `${brand.muted}40`, fontSize: 16 }}
          />
        </label>
      ) : null}
    </div>
  );
}
