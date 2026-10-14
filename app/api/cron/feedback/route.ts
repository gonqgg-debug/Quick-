import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueFeedbackSurveys } from "@/lib/order-feedback";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await sendDueFeedbackSurveys();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] feedback", error);
    return NextResponse.json({ error: "No pudimos enviar las encuestas" }, { status: 500 });
  }
}
