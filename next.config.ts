import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: 'camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), geolocation=(), browsing-topics=()' },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  compress: true,
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/:locale(fr|ar|en)/dashboard/boutique",
        destination: "/:locale/dashboard",
        permanent: true,
      },
      {
        source: "/:locale(fr|ar|en)/dashboard/classement",
        destination: "/:locale/dashboard",
        permanent: true,
      },
      {
        source: "/:locale(fr|ar|en)/dashboard/rendez-vous",
        destination: "/:locale/dashboard",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
