import "server-only";
import { env } from "@/server/env";
import { isTrustedMutationHeaders, normalizeTrustedOrigins } from "@/lib/security/origin-policy";

const trustedOrigins = normalizeTrustedOrigins(env.TRUSTED_ORIGINS);

/**
 * Defense-in-depth for ANEI custom cookie-authenticated mutations.
 * Better Auth protects its own routes; application Route Handlers still need
 * an exact-origin policy independent of UI visibility or SameSite assumptions.
 */
export function isTrustedMutation(request: Request) {
  return isTrustedMutationHeaders(request.headers, trustedOrigins);
}
