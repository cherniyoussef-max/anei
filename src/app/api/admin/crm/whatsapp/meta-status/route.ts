import { NextResponse } from "next/server";
import { getAdminSessionFor } from "@/server/auth/admin";
import { env } from "@/server/env";
import { whatsappConfigured, whatsappVerifyToken } from "@/server/whatsapp/config";

export async function GET() {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const webhookUrl = `${env.APP_URL}/api/webhooks/whatsapp`;

  return NextResponse.json({
    configured: whatsappConfigured,
    enabled: env.ENABLE_WHATSAPP,
    hasAccessToken: Boolean(env.WHATSAPP_ACCESS_TOKEN),
    hasAppSecret: Boolean(env.WHATSAPP_APP_SECRET),
    hasVerifyToken: Boolean(env.WHATSAPP_VERIFY_TOKEN),
    apiVersion: env.WHATSAPP_API_VERSION,
    apiBaseUrl: env.WHATSAPP_API_BASE_URL,
    webhookUrl,
    verifyToken: whatsappVerifyToken || "anei_verify_token_default",
  });
}
