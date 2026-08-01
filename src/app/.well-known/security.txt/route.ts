import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export function GET() {
  if (!env.SECURITY_CONTACT_EMAIL) return new Response("Not configured\n", { status: 404 });
  const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const canonical = new URL("/.well-known/security.txt", env.APP_URL).toString();
  const body = [
    `Contact: mailto:${env.SECURITY_CONTACT_EMAIL}`,
    `Expires: ${expires}`,
    `Canonical: ${canonical}`,
    "Preferred-Languages: fr, ar, en",
    "Policy: " + new URL("/fr/confidentialite", env.APP_URL).toString(),
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
