import { type NextRequest } from "next/server";
import { updateAdminSession } from "@/lib/admin-middleware";

export async function middleware(request: NextRequest) {
  return updateAdminSession(request);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
