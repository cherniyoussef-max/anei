import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { env } from "@/server/env";
import { db } from "@/server/db";
import { auditLogs, user } from "@/server/db/schema";
import { digestEqual } from "@/server/security/auth-otp-crypto";

export const IMPERSONATION_COOKIE_NAME = "anei_impersonation";
export const IMPERSONATION_TTL_MS = 30 * 60 * 1000; // 30 minutes max session

export interface ImpersonationPayload {
  impersonatorId: string;
  impersonatorName: string;
  impersonatorEmail: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  startedAt: number;
  expiresAt: number;
}

export function signImpersonationToken(payload: ImpersonationPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`anei:impersonate:v1:${payloadB64}`)
    .digest("hex");

  return `${payloadB64}.${signature}`;
}

export function verifyImpersonationToken(token: string): ImpersonationPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSig = crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`anei:impersonate:v1:${payloadB64}`)
    .digest("hex");

  if (!digestEqual(signature, expectedSig)) return null;

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(raw) as ImpersonationPayload;
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Returns the active impersonation payload if present, cryptographically valid,
 * and the impersonating user is still an active SUPER_ADMIN in PostgreSQL.
 */
export async function getImpersonationSession(headersList?: Headers): Promise<ImpersonationPayload | null> {
  let token: string | undefined;

  if (headersList) {
    const cookieHeader = headersList.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${IMPERSONATION_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
    } catch {
      // Non-request context
    }
  }

  if (!token) return null;

  const payload = verifyImpersonationToken(token);
  if (!payload) return null;

  // Strict enterprise gate: verify impersonator is STILL a valid active SUPER_ADMIN in live database
  const [impersonator] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, payload.impersonatorId))
    .limit(1);

  if (!impersonator || impersonator.role !== "SUPER_ADMIN") {
    return null;
  }

  return payload;
}

export async function getImpersonatedTargetUser(targetUserId: string) {
  const [targetUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      locale: user.locale,
      profileType: user.profileType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  return targetUser ?? null;
}

export async function isImpersonationActive(headersList?: Headers): Promise<boolean> {
  const session = await getImpersonationSession(headersList);
  return Boolean(session);
}

export function setImpersonationCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({
    name: IMPERSONATION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(IMPERSONATION_TTL_MS / 1000),
  });
}

export function clearImpersonationCookie(response: NextResponse) {
  response.cookies.set({
    name: IMPERSONATION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function recordImpersonationAudit(
  adminId: string,
  targetUserId: string,
  action: "start" | "stop",
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: adminId,
      action: action === "start" ? "user.impersonate.start" : "user.impersonate.stop",
      entityType: "user",
      entityId: targetUserId,
      metadata: metadata || {},
    });
  } catch {
    // Audit logging is non-blocking
  }
}
