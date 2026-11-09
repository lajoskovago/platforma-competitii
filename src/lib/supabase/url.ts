/**
 * Supabase project URL from the environment, normalised: people often paste the
 * Data API address (".../rest/v1/") or add a trailing slash, which makes every
 * auth request fail with "Invalid path specified in request URL".
 */
export function supabaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  return raw.replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, "");
}
