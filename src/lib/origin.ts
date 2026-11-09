import type { NextRequest } from "next/server";

/**
 * Public origin of the site as the visitor sees it.
 * Behind a reverse proxy (Render) `request.url` is the internal address
 * (e.g. http://localhost:10000), so prefer an explicit SITE_URL, then the
 * forwarded headers set by the proxy, then the request itself.
 */
export function publicOrigin(request: NextRequest) {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? request.nextUrl.protocol.replace(":", "");
  if (host) return `${proto}://${host.split(",")[0].trim()}`;
  return request.nextUrl.origin;
}

/** Absolute URL on the public origin. */
export function publicUrl(request: NextRequest, path: string) {
  return new URL(path, publicOrigin(request) + "/");
}
