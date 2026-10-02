import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "@/../next.config";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";

test("security-headers: next.config.ts defines required baseline headers", async () => {
  assert.equal(nextConfig.poweredByHeader, false, "poweredByHeader must be false to avoid tech stack disclosure");

  assert.ok(typeof nextConfig.headers === "function", "nextConfig.headers must be defined");
  const headersList = await nextConfig.headers();
  assert.ok(Array.isArray(headersList));

  const catchAll = headersList.find((entry) => entry.source === "/:path*");
  assert.ok(catchAll, "Must define /:path* catch-all headers");

  const headerMap = new Map(catchAll.headers.map((h) => [h.key, h.value]));

  assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headerMap.get("X-Frame-Options"), "DENY");
  assert.equal(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headerMap.get("X-DNS-Prefetch-Control"), "off");
  assert.equal(headerMap.get("Cross-Origin-Opener-Policy"), "same-origin");
  assert.match(headerMap.get("Permissions-Policy") ?? "", /camera=\(\)/);
  assert.match(headerMap.get("Permissions-Policy") ?? "", /microphone=\(\)/);
  assert.match(headerMap.get("Permissions-Policy") ?? "", /geolocation=\(\)/);
});

test("security-headers: proxy.ts enforces strict Content-Security-Policy and response headers", () => {
  const req = new NextRequest("https://anei.tn/fr/dashboard");
  const res = proxy(req);

  const csp = res.headers.get("content-security-policy");
  assert.ok(csp, "Content-Security-Policy header must be present on proxy response");

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /'nonce-[A-Za-z0-9+/=]+'/);

  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(res.headers.get("cross-origin-opener-policy"), "same-origin");
});
