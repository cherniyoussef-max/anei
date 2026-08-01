import { NextRequest, NextResponse } from "next/server";

/**
 * Strict per-request CSP for rendered pages. Next.js reads the nonce from the CSP
 * request header and applies it to framework scripts. This deliberately trades
 * static rendering for a stronger script policy on the authenticated LMS.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const connectSources = ["'self'"];
  const frameSources = ["'none'"];
  const googleAuthConfigured = process.env.ENABLE_GOOGLE_AUTH === "true"
    && Boolean(process.env.GOOGLE_CLIENT_ID?.trim())
    && Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());
  if (googleAuthConfigured) {
    connectSources.push("https://accounts.google.com");
    frameSources.splice(0, 1, "https://accounts.google.com");
  }
  if (process.env.STORAGE_PROVIDER === "s3-compatible") {
    try {
      if (process.env.STORAGE_ENDPOINT) {
        connectSources.push(new URL(process.env.STORAGE_ENDPOINT).origin);
      } else if (process.env.STORAGE_BUCKET && process.env.STORAGE_REGION) {
        connectSources.push(`https://${process.env.STORAGE_BUCKET}.s3.${process.env.STORAGE_REGION}.amazonaws.com`);
      }
    } catch {
      // Invalid production storage configuration is rejected by env validation.
    }
  }

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `frame-src ${frameSources.join(" ")}`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const pathLocale = request.nextUrl.pathname.split("/")[1];
  requestHeaders.set("x-anei-locale", pathLocale === "ar" ? "ar" : "fr");
  requestHeaders.set("x-anei-admin", /^\/(?:fr|ar)\/admin(?:\/|$)/.test(request.nextUrl.pathname) ? "1" : "0");
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
