export type NewAuthUser = Record<string, unknown> & {
  role?: unknown;
  locale?: unknown;
  profileType?: unknown;
};

/**
 * Roles are assigned only through ANEI's privileged role-management route.
 * No sign-up method (credentials, OAuth, or One Tap) may choose its own role.
 */
export function enforceNewUserDefaults<T extends NewAuthUser>(data: T) {
  return {
    ...data,
    role: "USER" as const,
    locale: data.locale === "ar" ? ("ar" as const) : ("fr" as const),
    profileType: typeof data.profileType === "string" ? data.profileType : "learner",
  };
}
