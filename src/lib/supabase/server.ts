import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabaseUrl } from "@/lib/supabase/url";

/** Supabase client acting as the logged-in user (RLS applies). */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** Privileged client (bypasses RLS). Only for admin-only server code. */
export function createSupabaseAdmin() {
  return createClient<Database>(
    supabaseUrl(),
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Stateless client for sending password-reset emails. Uses the implicit flow so
 * the emailed link works on any device (the default PKCE flow would require
 * opening it in the same browser that requested it).
 */
export function createSupabaseMailer() {
  return createClient<Database>(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } },
  );
}
