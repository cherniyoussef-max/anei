import "server-only";
import crypto from "node:crypto";
import { env } from "@/server/env";

/**
 * Phase 9 outbox-payload encryption for the worker-side template-send job.
 * Two parameters travel through the outbox deferral and cannot be re-derived
 * from the database:
 *
 * - the OTP digit string (`src/server/security/invitation-crypto.ts` never
 *   persists it raw), and
 * - the invitation URL (it embeds the raw invitation token, which Phase 6
 *   likewise never stores in plaintext).
 *
 * The whole parameter array is JSON-serialized and encrypted with AES-256-GCM
 * before it is ever written to `whatsapp_message.body_parameters_encrypted`;
 * the raw values are held only in the calling process's local variables and
 * are never persisted, logged, or placed in the outbox payload. Keyed off the
 * deployment's existing BETTER_AUTH_SECRET (same secret already reused for the
 * invitation/OTP HMAC digests and the mock-payment HMAC) with a
 * domain-separated HKDF-style derivation, rather than introducing a second
 * deployment secret.
 *
 * AES-256-GCM: a fresh random 12-byte nonce per encryption, authenticated
 * (tamper-evident) ciphertext. The ciphertext is scrubbed back to null on the
 * whatsapp_message row once the worker has attempted delivery (success or
 * terminal failure) — see src/server/queue/handlers/whatsapp-template-send.ts.
 */

const AAD = Buffer.from("anei:outbox:secret-parameters:v1");

function deriveKey(): Buffer {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update("outbox-otp-encryption:v1").digest();
}

export type EncryptedParameter = { ciphertext: string; nonce: string };

function validateSecretParameters(parameters: unknown[]): string[] {
  if (!Array.isArray(parameters) || !parameters.every((item) => typeof item === "string")) {
    throw new Error("OUTBOX_SECRET_PARAMETERS_INVALID");
  }
  return parameters;
}

/** Encrypts an array of secret template parameters (OTP, invitation URL) for durable, worker-deferred delivery. */
export function encryptSecretParameters(parameters: string[]): EncryptedParameter {
  const safe = validateSecretParameters(parameters);
  const key = deriveKey();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(AAD);
  const plaintext = JSON.stringify(safe);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

/**
 * Decrypts secret template parameters. Throws on tamper/corruption (never
 * silently returns bad data) — the caller must treat a throw as an
 * unrecoverable message defect (see the handler's DECRYPTION_FAILED path).
 */
export function decryptSecretParameters(value: EncryptedParameter): string[] {
  const key = deriveKey();
  const nonce = Buffer.from(value.nonce, "base64");
  const raw = Buffer.from(value.ciphertext, "base64");
  const authTag = raw.subarray(raw.length - 16);
  const encrypted = raw.subarray(0, raw.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(AAD);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return validateSecretParameters(JSON.parse(plaintext) as unknown[]);
}