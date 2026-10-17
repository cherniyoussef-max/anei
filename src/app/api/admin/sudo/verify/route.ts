import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";
import {
  issueSudoToken,
  recordSudoAuditEvent,
  SUDO_COOKIE_NAME,
  SUDO_SESSION_TTL_MS,
  verifyAdminPassword,
} from "@/server/auth/sudo";
import { env } from "@/server/env";

const bodySchema = z.object({
  password: z.string().min(1).max(256),
}).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Rate limit: max 5 password attempts per 15 minutes per admin to prevent brute force
  const rate = await consumeRateLimit(`admin-sudo:${session.user.id}`, 5, 900);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Trop de tentatives de confirmation. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "Mot de passe requis" }, { status: 400 });
  }

  const isValid = await verifyAdminPassword(session.user.id, parsed.data.password);
  if (!isValid) {
    await recordSudoAuditEvent(session.user.id, false, "Invalid password attempt");
    return NextResponse.json(
      { error: "INVALID_PASSWORD", message: "Mot de passe administrateur incorrect" },
      { status: 401 }
    );
  }

  const { token, expiresAt } = issueSudoToken(session.user.id);
  await recordSudoAuditEvent(session.user.id, true);

  const response = NextResponse.json({
    ok: true,
    expiresAt: expiresAt.toISOString(),
    message: "Mode Sudo activé avec succès pour 15 minutes.",
  });

  response.cookies.set({
    name: SUDO_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SUDO_SESSION_TTL_MS / 1000),
  });

  return response;
}
