import { NextResponse } from "next/server";
import { clearStaffSessionCookie } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  return clearStaffSessionCookie(NextResponse.json({ ok: true }));
}
