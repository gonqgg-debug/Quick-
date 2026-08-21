import { getSupabaseAdminClient } from "@/lib/supabase";
import { normalizePhoneNumber } from "@/lib/whatsapp";

export const ADDRESS_LABELS = ["Casa", "Trabajo", "Otro"] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export const KNOWN_RESIDENCIALES = ["Jardines III", "Crisfer", "Canas del Este"] as const;
export const RESIDENCIAL_OPTIONS = [...KNOWN_RESIDENCIALES, "Otro"] as const;
export type KnownResidencial = (typeof KNOWN_RESIDENCIALES)[number];
export type ResidencialOption = (typeof RESIDENCIAL_OPTIONS)[number];

export type AddressDraft = {
  residencial: ResidencialOption | "";
  edificio: string;
  apartamento: string;
  direccionLibre: string;
};

export const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  residencial: "",
  edificio: "",
  apartamento: "",
  direccionLibre: "",
};

export type StructuredAddressFields = {
  direccion: string;
  etiqueta: AddressLabel;
  residencial: ResidencialOption | null;
  edificio: string | null;
  apartamento: string | null;
};

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

export function isResidencialOption(value: unknown): value is ResidencialOption {
  return typeof value === "string" && RESIDENCIAL_OPTIONS.includes(value as ResidencialOption);
}

export function isKnownResidencial(value: unknown): value is KnownResidencial {
  return typeof value === "string" && KNOWN_RESIDENCIALES.includes(value as KnownResidencial);
}

export function formatKnownDireccion(
  residencial: KnownResidencial,
  edificio: string,
  apartamento: string
): string {
  return `${residencial}, Edif. ${edificio.trim()}, Apto ${apartamento.trim()}`;
}

export function isAddressDraftComplete(draft: AddressDraft): boolean {
  if (isKnownResidencial(draft.residencial)) {
    return draft.edificio.trim().length > 0 && draft.apartamento.trim().length > 0;
  }
  if (draft.residencial === "Otro") {
    return draft.direccionLibre.trim().length >= 6;
  }
  return false;
}

export function addressDraftToFields(
  draft: AddressDraft,
  etiqueta: AddressLabel
): StructuredAddressFields | null {
  if (!isAddressDraftComplete(draft) || !isResidencialOption(draft.residencial)) {
    return null;
  }
  if (isKnownResidencial(draft.residencial)) {
    const edificio = draft.edificio.trim();
    const apartamento = draft.apartamento.trim();
    return {
      direccion: formatKnownDireccion(draft.residencial, edificio, apartamento),
      etiqueta,
      residencial: draft.residencial,
      edificio,
      apartamento,
    };
  }
  return {
    direccion: draft.direccionLibre.trim(),
    etiqueta,
    residencial: "Otro",
    edificio: null,
    apartamento: null,
  };
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseStructuredAddress(
  value: unknown,
  etiquetaFallback: AddressLabel = "Casa"
): StructuredAddressFields | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const etiqueta = isAddressLabel(record.etiqueta) ? record.etiqueta : etiquetaFallback;
  if (!isAddressLabel(etiqueta)) {
    return null;
  }

  if (isKnownResidencial(record.residencial)) {
    const edificio = textField(record.edificio);
    const apartamento = textField(record.apartamento);
    if (!edificio || !apartamento) {
      return null;
    }
    return {
      direccion: formatKnownDireccion(record.residencial, edificio, apartamento),
      etiqueta,
      residencial: record.residencial,
      edificio,
      apartamento,
    };
  }

  const direccion = textField(record.direccion);
  if (direccion.length < 6) {
    return null;
  }
  return {
    direccion,
    etiqueta,
    residencial: record.residencial === "Otro" ? "Otro" : null,
    edificio: null,
    apartamento: null,
  };
}

export function parseNuevaDireccion(value: unknown): StructuredAddressFields | null {
  return parseStructuredAddress(value);
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
  } & StructuredAddressFields
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
    residencial: input.residencial,
    edificio: input.edificio,
    apartamento: input.apartamento,
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
  input: StructuredAddressFields
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
      residencial: input.residencial,
      edificio: input.edificio,
      apartamento: input.apartamento,
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
    nuevaDireccion?: StructuredAddressFields | null;
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
