// Product-facing personas (TEACHER/AVS/PARENT/SPECIALIST/ORGANIZATION/STUDENT)
// are a separate concept from the Better Auth security role (`user.role`:
// USER/ADMIN/SUPER_ADMIN). A user can hold multiple personas; exactly one is
// primary and drives default portal routing.

export const personas = ["STUDENT", "TEACHER", "AVS", "PARENT", "SPECIALIST", "ORGANIZATION"] as const;
export type Persona = (typeof personas)[number];

export const personaStatuses = ["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"] as const;
export type PersonaStatus = (typeof personaStatuses)[number];

export function isPersona(value: string): value is Persona {
  return (personas as readonly string[]).includes(value);
}

// Personas that require admin review before becoming ACTIVE.
const professionalPersonas: readonly Persona[] = ["TEACHER", "AVS", "SPECIALIST", "ORGANIZATION"];

export function isProfessionalPersona(persona: Persona): boolean {
  return professionalPersonas.includes(persona);
}

export function defaultStatusFor(persona: Persona): PersonaStatus {
  return isProfessionalPersona(persona) ? "PENDING_REVIEW" : "ACTIVE";
}

// Legacy `user.profileType` values (kept for backward compatibility) mapped
// onto canonical personas.
export const profileTypeToPersona: Record<string, Persona> = {
  learner: "STUDENT",
  teacher: "TEACHER",
  avs: "AVS",
  parent: "PARENT",
  specialist: "SPECIALIST",
  institution: "ORGANIZATION",
};

export type LegacyProfileType = keyof typeof profileTypeToPersona;

/**
 * LEGACY ONLY. For deriving a persona from a pre-existing/historical
 * `profileType` DB value (e.g. reading an already-created row). Silently
 * defaults an unrecognized value to STUDENT rather than throwing, because a
 * legacy row cannot be "rejected" after the fact.
 *
 * Never use this to validate new registration input — see
 * `parseRegistrationProfileType`, which rejects anything outside the six
 * supported values instead of defaulting.
 */
export function legacyPersonaFromProfileType(profileType: string): Persona {
  return profileTypeToPersona[profileType] ?? "STUDENT";
}

/**
 * STRICT, new-registration boundary only. Accepts exactly the six publicly
 * supported profileType values submitted by the registration dropdown.
 * Returns null for anything else (unknown string, empty string, wrong
 * type) — the caller must reject the request, never fall back to STUDENT.
 * The browser dropdown is not a security boundary; this is the single
 * canonical validator for that input, used at the actual registration
 * boundary before the user row is created.
 */
export function parseRegistrationProfileType(value: unknown): LegacyProfileType | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(profileTypeToPersona, value)
    ? (value as LegacyProfileType)
    : null;
}

// Portal root path per persona, relative to `/[locale]`. AVS deliberately
// uses `/avs/espace` (not `/avs`) because `/avs` is already the existing
// public, unauthenticated AVS directory listing page.
export const personaPortalPath: Record<Persona, string> = {
  STUDENT: "/dashboard",
  TEACHER: "/teacher",
  AVS: "/avs/espace",
  PARENT: "/parent",
  SPECIALIST: "/specialist",
  ORGANIZATION: "/organization",
};
