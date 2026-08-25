import "server-only";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { automationServiceCredential, organizationMembership } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { getSessionAssurance } from "@/server/auth/assurance";
import type { McpScope } from "./scopes";

/**
 * Actor authenticated against the MCP server.
 * - user: first-party browser session, resolved through the session resolver.
 * - service: automation service credential (Bearer token). userId is a stable
 *   synthetic id (`service:<credentialId>`) so tool executions record a
 *   consistent server actor for automation-originated writes.
 */
export interface McpActor {
  actorType: "user" | "service";
  userId: string;
  credentialId?: string;
  organizationId: string | null;
  organizationRole?: "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
  locale: "fr" | "ar";
  scopes: McpScope[];
}

type OrganizationRole = NonNullable<McpActor["organizationRole"]>;

/** Session resolution is injectable so integration tests can drive requests. */
export type McpSessionResolver = (
  request: Request,
) => Promise<{ user: { id: string; locale?: string | null }; session?: { id: string } } | null>;

let sessionResolver: McpSessionResolver | null = null;

export function setMcpSessionResolver(resolver: McpSessionResolver | null) {
  sessionResolver = resolver;
}

async function defaultSessionResolver(request: Request): Promise<{ user: { id: string; locale?: string | null }; session?: { id: string } } | null> {
  const { auth } = await import("@/server/auth");
  return auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
}

export const SYSTEM_AUTOMATION_USER_ID = "11111111-1111-4111-8111-111111111111";

export function hashServiceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

export type McpAuthResult =
  | { ok: true; actor: McpActor }
  | { ok: false; status: 401 | 403 | 429; error: string };

/**
 * Resolve the actor for an MCP request.
 *
 * 1. Bearer token -> automation service credential (ACTIVE, not expired).
 *    Service credentials bypass the browser origin check but are rate limited
 *    per credential.
 * 2. Otherwise -> browser session (origin-checked, rate limited per caller).
 *
 * Scopes are only meaningful for service actors; user sessions are authorized
 * by the ToolRegistry at execution time.
 */
export async function resolveMcpActor(request: Request): Promise<McpAuthResult> {
  const authorization = request.headers.get("authorization");
  const match = authorization ? BEARER_PATTERN.exec(authorization) : null;

  if (match) {
    const preAuthRate = await consumeRateLimit(`mcp:svc-preauth:${requestFingerprint(request)}`, 180, 60, { fallbackLimit: 20 });
    if (!preAuthRate.allowed) {
      return { ok: false, status: 429, error: "Too many requests" };
    }

    const token = match[1];
    const tokenHash = hashServiceToken(token);

    const [credential] = await db
      .select({
        id: automationServiceCredential.id,
        organizationId: automationServiceCredential.organizationId,
        scopes: automationServiceCredential.scopes,
        status: automationServiceCredential.status,
        expiresAt: automationServiceCredential.expiresAt,
      })
      .from(automationServiceCredential)
      .where(eq(automationServiceCredential.tokenHash, tokenHash))
      .limit(1);

    if (!credential || credential.status !== "ACTIVE") {
      return { ok: false, status: 401, error: "Invalid service credential" };
    }
    if (credential.expiresAt && credential.expiresAt.getTime() < Date.now()) {
      return { ok: false, status: 401, error: "Service credential expired" };
    }

    const rate = await consumeRateLimit(`mcp:svc:${credential.id}`, 120, 60, { fallbackLimit: 20 });
    if (!rate.allowed) {
      return { ok: false, status: 429, error: "Too many requests" };
    }

    const scopes = Array.isArray(credential.scopes) ? (credential.scopes as McpScope[]) : [];
    await db
      .update(automationServiceCredential)
      .set({ lastUsedAt: new Date() })
      .where(eq(automationServiceCredential.id, credential.id));

    return {
      ok: true,
      actor: {
        actorType: "service",
        userId: SYSTEM_AUTOMATION_USER_ID,
        credentialId: credential.id,
        organizationId: credential.organizationId ?? null,
        locale: "fr",
        scopes,
      },
    };
  }

  if (!isTrustedMutation(request)) {
    return { ok: false, status: 403, error: "Untrusted origin" };
  }

  const fingerprint = requestFingerprint(request);
  const sessionRate = await consumeRateLimit(`mcp:user:${fingerprint}`, 120, 60);
  if (!sessionRate.allowed) {
    return { ok: false, status: 429, error: "Too many requests" };
  }

  const resolver = sessionResolver ?? defaultSessionResolver;
  const session = await resolver(request);
  if (!session?.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (session.session?.id) {
    const assurance = await getSessionAssurance(session.session.id);
    if (!assurance) {
      return { ok: false, status: 403, error: "Session assurance required" };
    }
  }

  const [membership] = await db
    .select({
      organizationId: organizationMembership.organizationId,
      role: organizationMembership.role,
    })
    .from(organizationMembership)
    .where(and(eq(organizationMembership.userId, session.user.id), eq(organizationMembership.status, "ACTIVE")))
    .limit(1);

  return {
    ok: true,
    actor: {
      actorType: "user",
      userId: session.user.id,
      organizationId: membership?.organizationId ?? null,
      organizationRole: (membership?.role as OrganizationRole | undefined) ?? undefined,
      locale: session.user.locale === "ar" ? "ar" : "fr",
      scopes: [],
    },
  };
}

/**
 * Scope gate for service actors. User sessions bypass scope checks (ToolRegistry
 * authorize() is their enforcement point). Service actors must hold the scope
 * declared by the allowlist entry for the tool they call.
 */
export function assertScope(actor: McpActor, scope: McpScope): boolean {
  if (actor.actorType === "user") return true;
  return actor.scopes.includes(scope);
}
