import { NextResponse } from "next/server";
import { getSuperAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import {
  clearImpersonationCookie,
  getImpersonationSession,
  recordImpersonationAudit,
} from "@/server/auth/impersonation";

export async function GET(request: Request) {
  const impersonation = await getImpersonationSession();
  const url = new URL(request.url);
  const targetLocale = url.pathname.startsWith("/ar") ? "ar" : "fr";
  const redirectTarget = impersonation
    ? `/${targetLocale}/admin/users/${impersonation.targetUserId}`
    : `/${targetLocale}/admin/users`;

  if (impersonation) {
    await recordImpersonationAudit(impersonation.impersonatorId, impersonation.targetUserId, "stop");
  }

  const response = NextResponse.redirect(new URL(redirectTarget, request.url));
  clearImpersonationCookie(response);
  return response;
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getSuperAdminSession();
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const impersonation = await getImpersonationSession();
  const redirectTarget = impersonation
    ? `/fr/admin/users/${impersonation.targetUserId}`
    : `/fr/admin/users`;

  if (impersonation) {
    await recordImpersonationAudit(impersonation.impersonatorId, impersonation.targetUserId, "stop");
  }

  const response = NextResponse.json({ ok: true, redirectUrl: redirectTarget });
  clearImpersonationCookie(response);
  return response;
}
