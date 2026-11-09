import "server-only";
import { cookies } from "next/headers";

/**
 * Support impersonation state, kept in httpOnly cookies of the admin's browser:
 * - the admin's own refresh token, to return to their account afterwards
 * - the audit-log row id
 */
export const IMP_ADMIN_TOKEN = "imp_admin_rt";
export const IMP_LOG_ID = "imp_log_id";
export const IMP_MAX_AGE = 8 * 3600; // seconds

export const impCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: IMP_MAX_AGE,
};

export async function isImpersonating() {
  return !!(await cookies()).get(IMP_ADMIN_TOKEN)?.value;
}
