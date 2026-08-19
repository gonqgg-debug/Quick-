import { getSupabaseAdminClient } from "@/lib/supabase";
import { normalizePhoneNumber } from "@/lib/whatsapp";

export const ADDRESS_LABELS = ["Casa", "Trabajo", "Otro"] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export type CustomerAddress = {
  id: string;
  direccion: string;
  etiqueta: AddressLabel | null;
  esPredeterminada: boolean;
};

export type CatalogCustomer = {
  id: string;
  nombre: string;
  apellido: string;
  phoneNumber: string;
  addresses: CustomerAddress[];
};

type AddressRow = {
  id: unknown;
  direccion: unknown;
  etiqueta: unknown;
  es_predeterminada: unknown;
};

function phoneVariants(phoneNumber: string): string[] {
  const normalized = normalizePhoneNumber(phoneNumber);
  return Array.from(new Set([phoneNumber.trim(), normalized, `+${normalized}`].filter(Boolean)));
}

export function isAddressLabel(value: unknown): value is AddressLabel {
  return typeof value === "string" && ADDRESS_LABELS.includes(value as AddressLabel);
}

export function parseNuevaDireccion(
  value: unknown
): { direccion: string; etiqueta: AddressLabel } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const direccion = "direccion" in value && typeof value.direccion === "string" ? value.direccion.trim() : "";
  const etiqueta = "etiqueta" in value ? value.etiqueta : "Casa";
  if (direccion.length < 6 || !isAddressLabel(etiqueta)) {
    return null;
  }
  return { direccion, etiqueta };
}

function mapAddress(row: AddressRow): CustomerAddress {
  const etiqueta = isAddressLabel(row.etiqueta) ? row.etiqueta : null;
  return {
    id: String(row.id),
    direccion: String(row.direccion ?? "").trim(),
    etiqueta,
    esPredeterminada: Boolean(row.es_predeterminada),
  };
}

function mapCustomer(
  row: {
    id: unknown;
    nombre: unknown;
    apellido: unknown;
    phone_number: unknown;
    customer_addresses?: AddressRow[] | null;
  }
): CatalogCustomer {
  const addresses = (row.customer_addresses ?? [])
    .map(mapAddress)
    .filter((address) => address.direccion.length > 0)
    .sort((a, b) => Number(b.esPredeterminada) - Number(a.esPredeterminada));
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? "").trim(),
    apellido: String(row.apellido ?? "").trim(),
    phoneNumber: String(row.phone_number ?? ""),
    addresses,
  };
}

async function loadCustomerById(customerId: string): Promise<CatalogCustomer | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      id,
      nombre,
      apellido,
      phone_number,
      customer_addresses (
        id,
        direccion,
        etiqueta,
        es_predeterminada
      )
    `
    )
    .eq("id", customerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapCustomer(data);
}

export async function getCustomerForChat(chatId: string): Promise<CatalogCustomer | null> {
  const supabase = getSupabaseAdminClient();
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, phone_number, customer_id")
    .eq("id", chatId)
    .maybeSingle();

  if (chatError || !chat) {
    return null;
  }

  if (chat.customer_id) {
    return loadCustomerById(String(chat.customer_id));
  }

  const variants = phoneVariants(String(chat.phone_number ?? ""));
  if (variants.length === 0) {
    return null;
  }

  const { data: existing, error: lookupError } = await supabase
    .from("customers")
    .select("id")
    .in("phone_number", variants)
    .limit(1)
    .maybeSingle();

  if (lookupError || !existing?.id) {
    return null;
  }

  await supabase.from("chats").update({ customer_id: existing.id }).eq("id", chatId);
  return loadCustomerById(String(existing.id));
}

export async function registerCustomerForChat(
  chatId: string,
  input: {
    nombre: string;
    apellido: string;
    direccion: string;
    etiqueta: AddressLabel;
  }
): Promise<CatalogCustomer> {
  const existing = await getCustomerForChat(chatId);
  if (existing) {
    return existing;
  }

  const supabase = getSupabaseAdminClient();
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, phone_number, nombre")
    .eq("id", chatId)
    .maybeSingle();

  if (chatError || !chat) {
    throw new Error("No encontramos el chat de esta sesión");
  }

  const phoneNumber = normalizePhoneNumber(String(chat.phone_number ?? ""));
  if (!phoneNumber) {
    throw new Error("No pudimos leer el teléfono de WhatsApp");
  }

  const { data: created, error: createError } = await supabase
    .from("customers")
    .insert({
      phone_number: phoneNumber,
      nombre: input.nombre,
      apellido: input.apellido,
    })
    .select("id")
    .single();

  if (createError || !created) {
    if (createError && /duplicate|unique/i.test(createError.message)) {
      const recovered = await getCustomerForChat(chatId);
      if (recovered) {
        return recovered;
      }
    }
    console.error("[customers] no se pudo crear el cliente", createError);
    throw new Error("No pudimos guardar tus datos");
  }

  const { error: addressError } = await supabase.from("customer_addresses").insert({
    customer_id: created.id,
    direccion: input.direccion,
    etiqueta: input.etiqueta,
    es_predeterminada: true,
  });

  if (addressError) {
    console.error("[customers] no se pudo guardar la dirección", addressError);
    throw new Error("No pudimos guardar la dirección");
  }

  const fullName = `${input.nombre} ${input.apellido}`.trim();
  await supabase
    .from("chats")
    .update({
      customer_id: created.id,
      nombre: chat.nombre ? String(chat.nombre) : fullName,
    })
    .eq("id", chatId);

  const customer = await loadCustomerById(String(created.id));
  if (!customer) {
    throw new Error("No pudimos leer el cliente recién creado");
  }
  return customer;
}

export async function addCustomerAddress(
  customerId: string,
  input: { direccion: string; etiqueta: AddressLabel }
): Promise<CustomerAddress> {
  const supabase = getSupabaseAdminClient();
  const current = await loadCustomerById(customerId);
  const makeDefault = !current || current.addresses.length === 0;

  const { data, error } = await supabase
    .from("customer_addresses")
    .insert({
      customer_id: customerId,
      direccion: input.direccion,
      etiqueta: input.etiqueta,
      es_predeterminada: makeDefault,
    })
    .select("id, direccion, etiqueta, es_predeterminada")
    .single();

  if (error || !data) {
    console.error("[customers] no se pudo agregar dirección", error);
    throw new Error("No pudimos guardar la nueva dirección");
  }

  return mapAddress(data);
}

export async function resolveCheckoutAddress(
  customer: CatalogCustomer | null,
  input: {
    direccion: string;
    addressId?: string | null;
    nuevaDireccion?: { direccion: string; etiqueta: AddressLabel } | null;
  }
): Promise<{ direccion: string; customerId: string | null }> {
  if (!customer) {
    return { direccion: input.direccion, customerId: null };
  }

  if (input.addressId) {
    const saved = await getAddressForCustomer(customer.id, input.addressId);
    if (!saved) {
      throw new Error("Esa dirección no es válida.");
    }
    return { direccion: saved.direccion, customerId: customer.id };
  }

  if (input.nuevaDireccion) {
    const created = await addCustomerAddress(customer.id, input.nuevaDireccion);
    return { direccion: created.direccion, customerId: customer.id };
  }

  return { direccion: input.direccion, customerId: customer.id };
}

export async function getAddressForCustomer(
  customerId: string,
  addressId: string
): Promise<CustomerAddress | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("id, direccion, etiqueta, es_predeterminada")
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapAddress(data);
}
