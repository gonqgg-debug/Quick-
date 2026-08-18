import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const STAFF_COOKIE = "qo_staff";
const STAFF_COOKIE_MAX_AGE = 60 * 60 * 12;

function getStaffPassword(): string {
  return process.env.STAFF_PASSWORD?.trim() ?? "";
}

export function isStaffPasswordConfigured(): boolean {
  return getStaffPassword().length > 0;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function staffSessionToken(): string {
  return createHmac("sha256", getStaffPassword()).update("quick-orders-staff").digest("hex");
}

export function isValidStaffPassword(password: unknown): boolean {
  if (typeof password !== "string" || password.length === 0) {
    return false;
  }
  const expected = getStaffPassword();
  if (!expected) {
    return false;
  }
  return safeEqual(password, expected);
}

export function isStaffAuthorized(): boolean {
  const expected = getStaffPassword();
  if (!expected) {
    return false;
  }
  const token = cookies().get(STAFF_COOKIE)?.value ?? "";
  return token.length > 0 && safeEqual(token, staffSessionToken());
}

export function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

export function applyStaffSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(STAFF_COOKIE, staffSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STAFF_COOKIE_MAX_AGE,
  });
  return response;
}

export function clearStaffSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(STAFF_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
