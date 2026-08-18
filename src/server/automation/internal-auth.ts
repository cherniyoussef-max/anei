import "server-only";
import type { AutomationScope } from "@/server/mcp/scopes";
import { verifyServiceToken, type ServiceCredentialRecord } from "@/server/services/automation-credentials";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

export interface InternalAutomationActor {
  credentialId: string;
  organizationId: string | null;
}

export type InternalAuthResult =
  | { ok: true; actor: InternalAutomationActor }
  | { ok: false; response: Response };

/**
 * Authenticates a request against the n8n -> ANEI internal automation API.
 * Bearer token -> service credential (ACTIVE, not expired, rate limited per
 * credential). The scope is then checked per-endpoint by the caller via
 * requireScope. Origin checks do not apply here — this is a server-to-server
 * API on an internal network path (n8n cannot reach these routes from the
 * public internet; see docs/premium/N8N_SETUP.md for the network boundary).
 */
export async function authenticateInternalAutomation(request: Request): Promise<InternalAuthResult> {
  const preAuthRate = await consumeRateLimit(`automation:preauth:${requestFingerprint(request)}`, 120, 60);
  if (!preAuthRate.allowed) {
    return { ok: false, response: json(429, { error: "Too many requests" }) };
  }

  const authorization = request.headers.get("authorization");
  const match = authorization ? BEARER_PATTERN.exec(authorization) : null;
  if (!match) {
    return { ok: false, response: json(401, { error: "Missing service credential" }) };
  }

  const credential: ServiceCredentialRecord | null = await verifyServiceToken(match[1]);
  if (!credential) {
    return { ok: false, response: json(401, { error: "Invalid service credential" }) };
  }

  const rate = await consumeRateLimit(`automation:${credential.id}`, 300, 60);
  if (!rate.allowed) {
    return { ok: false, response: json(429, { error: "Too many requests" }) };
  }

  return {
    ok: true,
    actor: { credentialId: credential.id, organizationId: credential.organizationId },
  };
}

/**
 * Verifies the actor's credential holds the required scope. Returns a Response
 * on failure (for the route to return) or null when permitted.
 */
export async function requireAutomationScope(actor: InternalAutomationActor, scope: AutomationScope, request?: Request): Promise<Response | null> {
  const token = request?.headers.get("authorization") ?? "";
  const match = BEARER_PATTERN.exec(token);
  if (!match) return json(401, { error: "Missing service credential" });
  const credential = await verifyServiceToken(match[1]);
  if (!credential || credential.id !== actor.credentialId) return json(401, { error: "Invalid service credential" });
  if (!credential.scopes.includes(scope)) return json(403, { error: "Forbidden: missing scope" });
  return null;
}

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
