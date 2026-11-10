import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseUrl } from "@/lib/supabase/url";

/**
 * Client for the public (logged-out) pages. Uses the publishable key without a
 * session, so it can read only the public_* views granted to `anon`.
 */
export function createSupabasePublic() {
  return createClient<Database>(supabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Scores are not public for now (decision pending). Flip to true to show them. */
export const PUBLIC_SHOW_SCORES = false;
