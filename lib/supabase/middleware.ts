import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { roleFromClaims } from "@/lib/roles";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as Record<string, unknown> | null;
  const signedIn = Boolean(claims && typeof claims.sub === "string");
  const role = roleFromClaims(claims);
  const path = request.nextUrl.pathname;

  const isAdminPath = path.startsWith("/admin");
  const isAdminOpen =
    path === "/admin/login" ||
    path === "/admin/denied" ||
    path === "/admin/reset-password";

  if (isAdminPath && !isAdminOpen) {
    if (!signedIn) {
      const login = new URL("/admin/login", request.url);
      return NextResponse.redirect(login);
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/admin/denied", request.url));
    }
  }

  if (path === "/admin/login" && signedIn && role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}
