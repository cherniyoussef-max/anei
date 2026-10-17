import { z } from "zod";

export const liveProviderEnum = z.enum(["GOOGLE_MEET", "JITSI", "ZOOM", "MICROSOFT_TEAMS", "CUSTOM_EMBED"]);
export const liveEmbedModeEnum = z.enum(["IFRAME_EMBED", "PORTAL_LAUNCH"]);
export const liveScopeEnum = z.enum(["GLOBAL_WEBINAR", "COURSE_SPECIFIC"]);
export const liveStatusEnum = z.enum(["SCHEDULED", "LIVE_NOW", "ENDED", "CANCELLED"]);

export const liveCategoryEnum = z.enum([
  "EDUCATION_INCLUSIVE",
  "TROUBLES_APPRENTISSAGE",
  "SANTE_MENTALE",
  "PARENTALITE",
  "PRATIQUE_AVS",
]);

export const liveSessionCreateSchema = z.object({
  titleFr: z.string().trim().min(2, "Le titre français est requis (min 2 caractères)"),
  titleAr: z.string().trim().min(2, "العنوان بالعربية مطلوب (على الأقل حرفين)"),
  descriptionFr: z.string().trim().max(5000).optional().nullable(),
  descriptionAr: z.string().trim().max(5000).optional().nullable(),
  provider: liveProviderEnum,
  externalMeetingUrl: z.string().trim().url("L'URL de la réunion doit être valide"),
  embedMode: liveEmbedModeEnum,
  scope: liveScopeEnum,
  courseId: z.string().trim().optional().nullable().or(z.literal("")).transform((val) => val === "" ? null : val),
  category: liveCategoryEnum.default("EDUCATION_INCLUSIVE"),
  scheduledStartAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(60),
  isBroadcastPushed: z.boolean().default(false),
  speakerName: z.string().trim().max(255).optional().nullable(),
  replayUrl: z.string().trim().url("L'URL de rediffusion doit être valide").optional().nullable().or(z.literal("")).transform((val) => val === "" ? null : val),
  status: liveStatusEnum.default("SCHEDULED"),
});

export const liveSessionUpdateSchema = liveSessionCreateSchema.partial();

export function detectProviderAndEmbedMode(rawUrl: string): {
  provider: "GOOGLE_MEET" | "JITSI" | "ZOOM" | "MICROSOFT_TEAMS" | "CUSTOM_EMBED";
  embedMode: "IFRAME_EMBED" | "PORTAL_LAUNCH";
} {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.toLowerCase();

    if (host.includes("meet.google.com")) {
      return { provider: "GOOGLE_MEET", embedMode: "PORTAL_LAUNCH" };
    }
    if (host.includes("zoom.us")) {
      return { provider: "ZOOM", embedMode: "PORTAL_LAUNCH" };
    }
    if (host.includes("teams.microsoft.com") || host.includes("teams.live.com")) {
      return { provider: "MICROSOFT_TEAMS", embedMode: "PORTAL_LAUNCH" };
    }
    if (host.includes("meet.jit.si") || host.includes("8x8.vc") || host.includes("jitsi")) {
      return { provider: "JITSI", embedMode: "IFRAME_EMBED" };
    }
  } catch {
    // Malformed url
  }

  return { provider: "CUSTOM_EMBED", embedMode: "PORTAL_LAUNCH" };
}
