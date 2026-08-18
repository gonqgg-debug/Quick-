const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";
const GRAPH_API_BASE = "https://graph.facebook.com";

function getWhatsAppAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing environment variable: WHATSAPP_ACCESS_TOKEN");
  }
  return token;
}

function getWhatsAppPhoneNumberId(): string {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("Missing environment variable: WHATSAPP_PHONE_NUMBER_ID");
  }
  return phoneNumberId;
}

function getMessagesEndpoint(): string {
  return `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${getWhatsAppPhoneNumberId()}/messages`;
}

export type WhatsAppTextMessage = {
  to: string;
  body: string;
};

export type WhatsAppSendResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

async function postWhatsAppMessage(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const response = await fetch(getMessagesEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getWhatsAppAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function sendWhatsAppTextMessage({
  to,
  body,
}: WhatsAppTextMessage): Promise<WhatsAppSendResult> {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body,
    },
  });
}

export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode = "es",
}: {
  to: string;
  templateName: string;
  languageCode?: string;
}): Promise<WhatsAppSendResult> {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  });
}
