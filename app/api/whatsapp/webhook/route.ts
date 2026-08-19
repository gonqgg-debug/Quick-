import { NextRequest, NextResponse } from "next/server";
import { processWhatsAppWebhook } from "@/lib/whatsapp-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get("hub.mode");
    const token = request.nextUrl.searchParams.get("hub.verify_token");
    const challenge = request.nextUrl.searchParams.get("hub.challenge") ?? "";
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new NextResponse("Forbidden", { status: 403 });
  } catch (error) {
    console.error("[whatsapp] error en verificación GET", error);
    return new NextResponse("Forbidden", { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("[whatsapp] JSON inválido en webhook", error);
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  try {
    console.log("[whatsapp] webhook:process:start");
    await processWhatsAppWebhook(payload);
    console.log("[whatsapp] webhook:process:done");
  } catch (error) {
    console.error("[whatsapp] webhook:process:error", error);
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
