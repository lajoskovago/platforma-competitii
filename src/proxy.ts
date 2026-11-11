import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/origin";
import { supabaseUrl } from "@/lib/supabase/url";

// "/" is matched exactly (public schedule); the others also match their sub-paths
const PUBLIC_PATHS = [
  "/",
  "/campionat",
  "/login",
  "/auth/confirm",
  "/am-uitat-parola",
  "/inregistrare-oficiali",
  "/inregistrare-antrenori",
  "/api/cron", // protected by CRON_SECRET instead of a login
  "/sw.js",
  "/manifest.webmanifest",
  "/pwa-icon",
];

/**
 * Refreshes the Supabase session cookie on every request and sends
 * logged-out visitors to /login. Real authorization happens in the pages,
 * server actions and database (RLS).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));

  if (!data?.claims && !isPublic) {
    return NextResponse.redirect(publicUrl(request, "/login"));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
