import type { NextRequest } from "next/server";

/** Vercel Cron manda Authorization: Bearer CRON_SECRET. Sin secreto solo se permite fuera de producción. */
export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
