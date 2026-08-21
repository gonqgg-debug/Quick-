"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DeliveryAddressFields } from "@/components/catalog/DeliveryAddressFields";
import {
  ADDRESS_LABELS,
  EMPTY_ADDRESS_DRAFT,
  addressDraftToFields,
  customerAddressToDraft,
  formatCustomerPhone,
  isAddressDraftComplete,
  type AddressDraft,
  type AddressLabel,
  type CatalogCustomer,
  type CustomerAddress,
} from "@/lib/customers";
import { brand } from "@/lib/theme";

type MyProfileProps = {
  sessionId: string;
  customer: CatalogCustomer;
  onSaved: (customer: CatalogCustomer) => void;
};

type AddressEditor = {
  key: string;
  id: string | null;
  etiqueta: AddressLabel;
  draft: AddressDraft;
  esPredeterminada: boolean;
};

function toEditor(address: CustomerAddress): AddressEditor {
  return {
    key: address.id,
    id: address.id,
    etiqueta: address.etiqueta ?? "Casa",
    draft: customerAddressToDraft(address),
    esPredeterminada: address.esPredeterminada,
  };
}

function newEditor(makeDefault: boolean): AddressEditor {
  return {
    key: `new-${Date.now()}`,
    id: null,
    etiqueta: "Casa",
    draft: { ...EMPTY_ADDRESS_DRAFT },
    esPredeterminada: makeDefault,
  };
}

export function MyProfile({ sessionId, customer, onSaved }: MyProfileProps) {
  const [nombre, setNombre] = useState(customer.nombre);
  const [apellido, setApellido] = useState(customer.apellido);
  const [addresses, setAddresses] = useState<AddressEditor[]>(() => customer.addresses.map(toEditor));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNombre(customer.nombre);
    setApellido(customer.apellido);
    setAddresses(customer.addresses.map(toEditor));
    setEditingKey(null);
  }, [customer]);

  useEffect(() => {
    if (!saved) {
      return;
    }
    const timer = window.setTimeout(() => setSaved(false), 2800);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const phone = useMemo(() => formatCustomerPhone(customer.phoneNumber), [customer.phoneNumber]);

  function patchAddress(key: string, partial: Partial<AddressEditor>) {
    setAddresses((current) => current.map((address) => (address.key === key ? { ...address, ...partial } : address)));
  }

  function setDefault(key: string) {
    setAddresses((current) => current.map((address) => ({ ...address, esPredeterminada: address.key === key })));
  }

  function startAdd() {
    const next = newEditor(addresses.length === 0);
    setAddresses((current) => [...current, next]);
    setEditingKey(next.key);
    setSaved(false);
  }

  function removeAddress(key: string) {
    setAddresses((current) => {
      if (current.length <= 1) {
        return current;
      }
      const remaining = current.filter((address) => address.key !== key);
      if (!remaining.some((address) => address.esPredeterminada) && remaining[0]) {
        remaining[0] = { ...remaining[0], esPredeterminada: true };
      }
      return remaining;
    });
    setEditingKey((current) => (current === key ? null : current));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (nombre.trim().length < 2 || apellido.trim().length < 2) {
      setError("Escribe tu nombre y apellido.");
      return;
    }
    const payload = addresses.map((address) => {
      const fields = addressDraftToFields(address.draft, address.etiqueta);
      return fields
        ? {
            id: address.id,
            esPredeterminada: address.esPredeterminada,
            ...fields,
          }
        : null;
    });
    if (payload.some((address) => address === null)) {
      setError("Completa cada dirección antes de guardar.");
      const incomplete = addresses.find((address) => !isAddressDraftComplete(address.draft));
      if (incomplete) {
        setEditingKey(incomplete.key);
      }
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/catalog/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          addresses: payload,
        }),
      });
      const body = (await response.json()) as {
        success?: boolean;
        customer?: CatalogCustomer;
        error?: string;
      };
      if (!response.ok || !body.success || !body.customer) {
        throw new Error(body.error || "No pudimos guardar tus datos");
      }
      onSaved(body.customer);
      setEditingKey(null);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No pudimos guardar tus datos");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pb-8">
      <p className="text-sm leading-relaxed text-brand-muted">
        Tus datos para entregas. El WhatsApp queda fijo porque es como te reconocemos.
      </p>

      {saved ? (
        <p
          className="mt-4 rounded-2xl px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: "#EAF6D8", color: "#3F7A12" }}
          role="status"
        >
          Cambios guardados
        </p>
      ) : null}

      <label className="mt-5 block">
        <span className="text-sm font-bold text-brand-ink">WhatsApp</span>
        <p
          className="mt-2 w-full rounded-2xl border bg-gray-50 px-4 py-3 text-base text-brand-ink"
          style={{ borderColor: `${brand.muted}28`, minHeight: 48 }}
        >
          {phone}
        </p>
      </label>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-bold text-brand-ink">Nombre</span>
          <input
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              setSaved(false);
            }}
            autoComplete="given-name"
            className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none"
            style={{ borderColor: `${brand.muted}40`, minHeight: 48 }}
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-brand-ink">Apellido</span>
          <input
            value={apellido}
            onChange={(event) => {
              setApellido(event.target.value);
              setSaved(false);
            }}
            autoComplete="family-name"
            className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none"
            style={{ borderColor: `${brand.muted}40`, minHeight: 48 }}
          />
        </label>
      </div>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-brand-ink">Direcciones</h2>
          <button
            type="button"
            onClick={startAdd}
            className="text-sm font-bold"
            style={{ color: brand.green }}
          >
            + Agregar
          </button>
        </div>

        <ul className="mt-3 space-y-3">
          {addresses.map((address) => {
            const open = editingKey === address.key;
            const complete = isAddressDraftComplete(address.draft);
            const preview = complete
              ? addressDraftToFields(address.draft, address.etiqueta)?.direccion
              : "Completa esta dirección";
            return (
              <li
                key={address.key}
                className="overflow-hidden rounded-[24px] border bg-white"
                style={{ borderColor: address.esPredeterminada ? `${brand.green}55` : "#E5E7EB" }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-bold" style={{ color: brand.muted }}>
                        <span>{address.etiqueta}</span>
                        {address.esPredeterminada ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: brand.green }}
                          >
                            Habitual
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug text-brand-ink">{preview}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingKey(open ? null : address.key)}
                      className="shrink-0 text-sm font-bold"
                      style={{ color: brand.blue }}
                    >
                      {open ? "Cerrar" : "Editar"}
                    </button>
                  </div>

                  {open ? (
                    <div className="mt-4 border-t pt-4" style={{ borderColor: "#F3F4F6" }}>
                      <DeliveryAddressFields
                        value={address.draft}
                        onChange={(draft) => patchAddress(address.key, { draft })}
                      />
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {ADDRESS_LABELS.map((label) => {
                          const selected = address.etiqueta === label;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => patchAddress(address.key, { etiqueta: label })}
                              className="rounded-2xl border-2 bg-white py-2.5 text-sm font-bold"
                              style={{
                                borderColor: selected ? brand.green : `${brand.muted}40`,
                                color: selected ? brand.green : brand.ink,
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!address.esPredeterminada ? (
                      <button
                        type="button"
                        onClick={() => setDefault(address.key)}
                        className="rounded-full border px-3 py-1.5 text-xs font-bold"
                        style={{ borderColor: `${brand.green}55`, color: brand.green }}
                      >
                        Usar como habitual
                      </button>
                    ) : null}
                    {addresses.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeAddress(address.key)}
                        className="rounded-full border px-3 py-1.5 text-xs font-bold"
                        style={{ borderColor: `${brand.error}30`, color: brand.error }}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full py-3.5 text-base font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: brand.green, minHeight: 48 }}
      >
        {submitting ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
