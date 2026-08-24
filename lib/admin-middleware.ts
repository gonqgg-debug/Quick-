import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ADMIN_ROLE } from "@/lib/admin-role";

/** Stay well under Vercel's 25s Edge middleware limit. */
const GET_USER_TIMEOUT_MS = 2500;
const GET_SESSION_TIMEOUT_MS = 500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AUTH_TIMEOUT")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function readLocalSessionUser(
  supabase: ReturnType<typeof createServerClient>
): Promise<User | null> {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), GET_SESSION_TIMEOUT_MS);
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}

async function resolveUser(
  supabase: ReturnType<typeof createServerClient>,
  allowNetwork: boolean
): Promise<User | null> {
  if (!allowNetwork) {
    return readLocalSessionUser(supabase);
  }

  try {
    const { data } = await withTimeout(supabase.auth.getUser(), GET_USER_TIMEOUT_MS);
    return data.user ?? null;
  } catch {
    return readLocalSessionUser(supabase);
  }
}

export async function updateAdminSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/admin/login";

  if (!url || !anonKey) {
    if (!isLogin) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/admin/login";
      redirect.searchParams.set("next", pathname);
      return NextResponse.redirect(redirect);
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const user = await resolveUser(supabase, !isLogin);
  const isAdmin = Boolean(user && user.app_metadata?.role === ADMIN_ROLE);

  if (!isLogin && !isAdmin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/admin/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (isLogin && isAdmin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/admin";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}
