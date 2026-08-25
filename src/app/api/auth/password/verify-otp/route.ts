import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { authVerificationChallenge, user } from "@/server/db/schema";
import { verifyOtp } from "@/server/auth/otp";
import { issuePasswordResetAuthorization } from "@/server/auth/password-recovery";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getRequestId } from "@/server/auth/request-id";

const schema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, parsed.data.email.trim().toLowerCase())).limit(1);
  if (!account) return NextResponse.json({ error: "INVALID_OTP" }, { status: 400 });

  const [challenge] = await db
    .select({ id: authVerificationChallenge.id })
    .from(authVerificationChallenge)
    .where(
      and(
        eq(authVerificationChallenge.userId, account.id),
        eq(authVerificationChallenge.purpose, "PASSWORD_RESET"),
        eq(authVerificationChallenge.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(authVerificationChallenge.createdAt))
    .limit(1);

  if (!challenge) return NextResponse.json({ error: "INVALID_OTP" }, { status: 400 });

  const requestId = getRequestId(request);
  const verified = await verifyOtp({
    requestId,
    userId: account.id,
    sessionId: null,
    challengeId: challenge.id,
    purpose: "PASSWORD_RESET",
    code: parsed.data.code,
  });

  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  const authorization = await issuePasswordResetAuthorization({
    userId: account.id,
    requestId,
    challengeId: challenge.id,
  });

  return NextResponse.json({ ok: true, resetAuthorizationToken: authorization.token, expiresAt: authorization.expiresAt });
}
