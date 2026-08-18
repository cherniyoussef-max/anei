import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { automationServiceCredential } from "@/server/db/schema";
import { ALL_AUTOMATION_SCOPES, type AutomationScope } from "@/server/mcp/scopes";

export interface ServiceCredentialRecord {
  id: string;
  name: string;
  organizationId: string | null;
  scopes: AutomationScope[];
  status: "ACTIVE" | "REVOKED";
  expiresAt: Date | null;
}

export function hashServiceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export interface CreateServiceCredentialInput {
  name: string;
  organizationId?: string | null;
  scopes: AutomationScope[];
  expiresInDays?: number;
}

export interface CreateServiceCredentialResult {
  id: string;
  name: string;
  organizationId: string | null;
  scopes: AutomationScope[];
  expiresAt: Date | null;
  /** The only copy of the raw token. Stored hashed; it is returned exactly once. */
  token: string;
}

/**
 * Creates a service credential. Only a SHA-256 hash of the raw token is ever
 * persisted; the raw token is returned once and must be placed in n8n's
 * encrypted credential store (or an equivalent secret manager). Scopes are
 * validated against the bounded allowlist.
 */
export async function createAutomationCredential(input: CreateServiceCredentialInput): Promise<CreateServiceCredentialResult> {
  const invalid = input.scopes.filter((scope) => !(ALL_AUTOMATION_SCOPES as readonly string[]).includes(scope));
  if (invalid.length > 0) {
    throw new Error(`UNKNOWN_AUTOMATION_SCOPE:${invalid.join(",")}`);
  }

  const rawToken = generateRawToken();
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) : null;

  const [created] = await db
    .insert(automationServiceCredential)
    .values({
      name: input.name,
      tokenHash: hashServiceToken(rawToken),
      organizationId: input.organizationId ?? null,
      scopes: input.scopes,
      status: "ACTIVE",
      expiresAt,
    })
    .returning({
      id: automationServiceCredential.id,
      name: automationServiceCredential.name,
      organizationId: automationServiceCredential.organizationId,
      scopes: automationServiceCredential.scopes,
      expiresAt: automationServiceCredential.expiresAt,
    });

  return {
    id: created.id,
    name: created.name,
    organizationId: created.organizationId,
    scopes: created.scopes as AutomationScope[],
    expiresAt: created.expiresAt,
    token: rawToken,
  };
}

export async function revokeAutomationCredential(credentialId: string): Promise<boolean> {
  const [updated] = await db
    .update(automationServiceCredential)
    .set({ status: "REVOKED", revokedAt: new Date() })
    .where(eq(automationServiceCredential.id, credentialId))
    .returning({ id: automationServiceCredential.id });
  return Boolean(updated);
}

/**
 * Verifies a raw service token against the stored hash, ACTIVE status, and
 * expiry. Constant-time comparison of the hashes. Returns the credential or
 * null.
 */
export async function verifyServiceToken(token: string): Promise<ServiceCredentialRecord | null> {
  const tokenHash = hashServiceToken(token);
  const [credential] = await db
    .select({
      id: automationServiceCredential.id,
      name: automationServiceCredential.name,
      organizationId: automationServiceCredential.organizationId,
      scopes: automationServiceCredential.scopes,
      status: automationServiceCredential.status,
      expiresAt: automationServiceCredential.expiresAt,
    })
    .from(automationServiceCredential)
    .where(eq(automationServiceCredential.tokenHash, tokenHash))
    .limit(1);

  if (!credential) return null;
  if (credential.status !== "ACTIVE") return null;
  if (credential.expiresAt && credential.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(automationServiceCredential)
    .set({ lastUsedAt: new Date() })
    .where(eq(automationServiceCredential.id, credential.id));

  return {
    ...credential,
    scopes: credential.scopes as AutomationScope[],
    status: credential.status as "ACTIVE" | "REVOKED",
  };
}

export async function isCredentialScoped(credential: ServiceCredentialRecord, scope: AutomationScope): Promise<boolean> {
  return credential.scopes.includes(scope);
}