import { NextResponse } from "next/server";
import { getAdminSessionFor } from "@/server/auth/admin";
import { env } from "@/server/env";
import {
  instagramConfigured,
  instagramVerifyToken,
  messengerConfigured,
  messengerVerifyToken,
  metaAppSecret,
} from "@/server/social/config";

export async function GET() {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const appUrl = env.APP_URL;

  return NextResponse.json({
    messenger: {
      configured: messengerConfigured,
      webhookCallbackUrl: `${appUrl}/api/webhooks/messenger`,
      verifyToken: messengerVerifyToken ?? "not_configured",
      appSecretConfigured: Boolean(metaAppSecret),
    },
    instagram: {
      configured: instagramConfigured,
      webhookCallbackUrl: `${appUrl}/api/webhooks/instagram`,
      verifyToken: instagramVerifyToken ?? "not_configured",
      appSecretConfigured: Boolean(metaAppSecret),
    },
  });
}
