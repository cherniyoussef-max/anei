import { NextResponse } from "next/server";
import { z } from "zod";
import { mockGateway, verifyMockToken } from "@/server/payments/mock";
import { markMockOrderPaid } from "@/server/services/checkout";
import { env } from "@/server/env";
import { isTrustedMutation } from "@/server/security/origin";

const schema = z.object({
  order: z.string().uuid(),
  token: z.string().min(32).max(256),
  locale: z.enum(["fr", "ar"]).default("fr"),
});

/**
 * Development-only payment completion. It is deliberately POST-only so link
 * previews, crawlers and browser prefetching can never mutate payment state.
 */
export async function POST(request: Request) {
  if (!mockGateway.isConfigured()) return new NextResponse("Not found", { status: 404 });
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 16 * 1024) return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const parsed = schema.safeParse(form ? Object.fromEntries(form.entries()) : null);
  const locale = parsed.success ? parsed.data.locale : "fr";

  if (!parsed.success || !verifyMockToken(parsed.data.order, parsed.data.token)) {
    return NextResponse.redirect(new URL(`/${locale}/paiement/echec?reason=invalid`, env.APP_URL), 303);
  }

  try {
    await markMockOrderPaid(parsed.data.order);
    return NextResponse.redirect(
      new URL(`/${locale}/paiement/succes?order=${encodeURIComponent(parsed.data.order)}`, env.APP_URL),
      303,
    );
  } catch {
    return NextResponse.redirect(new URL(`/${locale}/paiement/echec?reason=processing`, env.APP_URL), 303);
  }
}
