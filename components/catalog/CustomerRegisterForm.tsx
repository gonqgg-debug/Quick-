"use client";

import { FormEvent, useState } from "react";
import { DeliveryAddressFields } from "@/components/catalog/DeliveryAddressFields";
import { Logo } from "@/components/brand/Logo";
import {
  ADDRESS_LABELS,
  EMPTY_ADDRESS_DRAFT,
  addressDraftToFields,
  isAddressDraftComplete,
  type AddressDraft,
  type AddressLabel,
  type CatalogCustomer,
} from "@/lib/customers";
import { brand } from "@/lib/theme";

type CustomerRegisterFormProps = {
  sessionId: string;
  onRegistered: (customer: CatalogCustomer) => void;
};

export function CustomerRegisterForm({ sessionId, onRegistered }: CustomerRegisterFormProps) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [address, setAddress] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const [etiqueta, setEtiqueta] = useState<AddressLabel>("Casa");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    nombre.trim().length >= 2 &&
    apellido.trim().length >= 2 &&
    isAddressDraftComplete(address) &&
    !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fields = addressDraftToFields(address, etiqueta);
    if (!canSubmit || !fields) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/catalog/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          ...fields,
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
      onRegistered(body.customer);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pudimos guardar tus datos");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-white px-4 py-8">
      <section className="w-full max-w-lg">
        <Logo />
        <h1 className="font-display mt-6 text-3xl font-bold leading-tight text-brand-ink">
          Antes de pedir, cuéntanos quién eres
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
          Usamos el WhatsApp desde el que abriste este enlace. Solo necesitamos tu nombre y a dónde te llevamos el pedido.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-bold text-brand-ink">Nombre</span>
              <input
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                autoComplete="given-name"
                placeholder="María"
                className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none placeholder:text-brand-muted"
                style={{ borderColor: `${brand.muted}40`, minHeight: 48 }}
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-brand-ink">Apellido</span>
              <input
                value={apellido}
                onChange={(event) => setApellido(event.target.value)}
                autoComplete="family-name"
                placeholder="Pérez"
                className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none placeholder:text-brand-muted"
                style={{ borderColor: `${brand.muted}40`, minHeight: 48 }}
              />
            </label>
          </div>

          <DeliveryAddressFields value={address} onChange={setAddress} />

          <fieldset>
            <legend className="text-sm font-bold text-brand-ink">¿Qué dirección es?</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ADDRESS_LABELS.map((label) => {
                const selected = etiqueta === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setEtiqueta(label)}
                    className="rounded-2xl border-2 bg-white py-3 text-sm font-bold"
                    style={{
                      borderColor: selected ? brand.green : `${brand.muted}40`,
                      color: selected ? brand.green : brand.ink,
                      minHeight: 48,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p
              className="rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: "#FEE2E2", color: brand.error }}
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-full py-3.5 text-base font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: brand.green, minHeight: 48 }}
          >
            {submitting ? "Guardando..." : "Continuar al catálogo"}
          </button>
        </form>
      </section>
    </main>
  );
}
