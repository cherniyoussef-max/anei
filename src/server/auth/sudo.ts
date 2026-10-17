import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { verifyPassword } from "@better-auth/utils/password";
import { env } from "@/server/env";
import { db } from "@/server/db";
import { account, auditLogs } from "@/server/db/schema";
import { digestEqual } from "@/server/security/auth-otp-crypto";

export const SUDO_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes, conforming to enterprise standard (GitHub Sudo Mode)
export const SUDO_COOKIE_NAME = "anei_sudo_session";

interface SudoPayload {
  adminId: string;
  verifiedAt: number;
  expiresAt: number;
}

export async function verifyAdminPassword(userId: string, passwordAttempt: string): Promise<boolean> {
  if (!passwordAttempt || typeof passwordAttempt !== "string") return false;

  const [credAccount] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);

  if (!credAccount || !credAccount.password) return false;

  try {
    return await verifyPassword(credAccount.password, passwordAttempt);
  } catch {
    return false;
  }
}

export function issueSudoToken(adminId: string): { token: string; expiresAt: Date } {
  const now = Date.now();
  const expiresAtMs = now + SUDO_SESSION_TTL_MS;
  const payload: SudoPayload = {
    adminId,
    verifiedAt: now,
    expiresAt: expiresAtMs,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`anei:sudo:v1:${payloadB64}`)
    .digest("hex");

  return {
    token: `${payloadB64}.${signature}`,
    expiresAt: new Date(expiresAtMs),
  };
}

export function verifySudoToken(token: string, expectedAdminId: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  const expectedSig = crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`anei:sudo:v1:${payloadB64}`)
    .digest("hex");

  if (!digestEqual(signature, expectedSig)) return false;

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(raw) as SudoPayload;
    if (payload.adminId !== expectedAdminId) return false;
    if (Date.now() > payload.expiresAt) return false;
    return true;
  } catch {
    return false;
  }
}

export async function isSudoModeActive(request: Request | null, adminId: string): Promise<boolean> {
  // 1. Check direct header (useful for automated scripts or instantaneous confirmations)
  if (request) {
    const headerPassword = request.headers.get("x-sudo-password");
    if (headerPassword) {
      const isValid = await verifyAdminPassword(adminId, headerPassword);
      if (isValid) return true;
    }
  }

  // 2. Check cookie from request headers if available
  if (request) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SUDO_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        const token = decodeURIComponent(match[1]);
        if (verifySudoToken(token, adminId)) return true;
      }
    }
  }

  // 3. Fallback to Next.js cookies() store
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SUDO_COOKIE_NAME);
    if (cookie?.value && verifySudoToken(cookie.value, adminId)) {
      return true;
    }
  } catch {
    // Non-request context
  }

  return false;
}

export async function recordSudoAuditEvent(adminId: string, success: boolean, reason?: string) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: adminId,
      action: success ? "admin.sudo.enter" : "admin.sudo.failed",
      entityType: "security",
      entityId: adminId,
      metadata: { reason: reason || (success ? "Sudo mode activated" : "Password verification failed") },
    });
  } catch {
    // Audit logging is non-blocking
  }
}
