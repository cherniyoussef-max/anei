import { APIError } from "better-auth/api";
import { parseRegistrationProfileType } from "@/modules/personas/domain/permissions";

export type NewAuthUser = Record<string, unknown> & {
  role?: unknown;
  locale?: unknown;
  profileType?: unknown;
};

/**
 * Roles are assigned only through ANEI's privileged role-management route.
 * No sign-up method (credentials, OAuth, or One Tap) may choose its own role.
 *
 * `profileType`: omitted entirely (e.g. OAuth/One Tap, which have no
 * registration-persona dropdown) defaults to "learner" (STUDENT). If a
 * value IS submitted (the credentials sign-up form always sends one), it
 * must be one of the six publicly supported values — anything else
 * (unknown/empty/malformed/arbitrary) is rejected here, before the user
 * row is created, rather than silently coerced into a student account.
 */
export function enforceNewUserDefaults<T extends NewAuthUser>(data: T) {
  let profileType = "learner";
  if (data.profileType !== undefined) {
    const parsed = parseRegistrationProfileType(data.profileType);
    if (!parsed) {
      throw new APIError("BAD_REQUEST", { message: "Invalid profileType" });
    }
    profileType = parsed;
  }
  return {
    ...data,
    role: "USER" as const,
    locale: data.locale === "ar" ? ("ar" as const) : ("fr" as const),
    profileType,
  };
}
