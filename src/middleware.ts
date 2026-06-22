import { NextResponse, type NextRequest } from "next/server";

// Per-request CSP nonce for the admin panel. Next.js App Router emits inline
// bootstrap/hydration scripts, so a strict `script-src 'self'` would break the
// UI. A nonce + 'strict-dynamic' lets exactly Next's own scripts run and nothing
// injected. Next picks the nonce up from the CSP on the *request* headers and
// stamps it onto every <script> it renders.
//
// Scoped to admin HTML routes only (not /admin/api — JSON responses ignore CSP).
export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/((?!api/).*)"],
};
