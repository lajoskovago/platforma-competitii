import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/origin";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Landing point for links in invitation / password reset emails. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (tokenHash && type) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(publicUrl(request, next));
    console.error("[auth/confirm] verifyOtp failed", type, error.message);
  }

  const url = publicUrl(request, "/login");
  url.searchParams.set("eroare", "link");
  return NextResponse.redirect(url);
}
