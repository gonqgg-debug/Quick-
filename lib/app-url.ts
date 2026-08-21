const DEFAULT_LOCAL_URL = "http://localhost:3000";

/** Canonical public site URL. Set NEXT_PUBLIC_APP_URL in Vercel to https://quickminimarket.com */
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  return DEFAULT_LOCAL_URL;
}

export function publicOrderUrl(sessionId: string): string {
  return `${appBaseUrl()}/order/${sessionId}`;
}

export function publicMyOrdersUrl(sessionId: string): string {
  return `${publicOrderUrl(sessionId)}#mis-pedidos`;
}
