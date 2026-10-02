import { z } from "zod";
import type { WebinarMeetingProvider } from "./webinars";

export const ALLOWED_WEBINAR_HOSTS: Record<
  Exclude<WebinarMeetingProvider, "in_person">,
  (host: string) => boolean
> = {
  google_meet: (host) => host === "meet.google.com",
  teams: (host) =>
    host === "teams.microsoft.com" ||
    host === "teams.live.com" ||
    host.endsWith(".teams.microsoft.com"),
  zoom: (host) => host === "zoom.us" || host.endsWith(".zoom.us"),
  custom: () => true, // custom allows any domain as long as protocol is https and no credentials
};

/**
 * Validates webinar meeting URLs with strict protocol, userinfo, and host allowlist checks.
 * Rejects javascript:, data:, vbscript:, http:, and unauthorized hosts.
 */
export function validateWebinarMeetingUrl(
  provider: WebinarMeetingProvider,
  urlStr?: string | null,
): { valid: boolean; error?: string } {
  if (provider === "in_person") {
    if (urlStr && urlStr.trim().length > 0) {
      return { valid: false, error: "IN_PERSON_CANNOT_HAVE_MEETING_URL" };
    }
    return { valid: true };
  }

  if (!urlStr || typeof urlStr !== "string" || !urlStr.trim()) {
    return { valid: false, error: "MEETING_URL_REQUIRED" };
  }

  try {
    const trimmed = urlStr.trim();
    const parsed = new URL(trimmed);

    // Protocol must be strictly https:
    if (parsed.protocol !== "https:") {
      return { valid: false, error: "HTTPS_REQUIRED" };
    }

    // No credentials/userinfo (e.g. https://evil.com@meet.google.com)
    if (parsed.username || parsed.password) {
      return { valid: false, error: "USERINFO_FORBIDDEN" };
    }

    const hostValidator = ALLOWED_WEBINAR_HOSTS[provider];
    if (!hostValidator || !hostValidator(parsed.hostname.toLowerCase())) {
      return { valid: false, error: "HOST_NOT_ALLOWLISTED" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "INVALID_URL" };
  }
}

/**
 * Validates replay URLs: must be https, no userinfo.
 */
export function validateWebinarReplayUrl(urlStr?: string | null): { valid: boolean; error?: string } {
  if (!urlStr || !urlStr.trim()) return { valid: true };
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== "https:") {
      return { valid: false, error: "HTTPS_REQUIRED" };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, error: "USERINFO_FORBIDDEN" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "INVALID_URL" };
  }
}

const baseWebinarFields = {
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120),
  titleFr: z.string().min(3).max(180),
  titleAr: z.string().min(3).max(180),
  descriptionFr: z.string().min(3).max(2000),
  descriptionAr: z.string().min(3).max(2000),
  trainerName: z.string().min(2).max(120),
  startsAt: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), {
    message: "Invalid date format",
  }),
  durationMinutes: z.number().int().min(15).max(1440),
  meetingId: z.string().max(120).nullable().optional(),
  meetingPasscode: z.string().max(120).nullable().optional(),
  targetAudience: z.string().max(120).nullable().optional(),
  maxParticipants: z.number().int().min(1).max(5000).default(250),
  formFields: z.array(z.any()).optional().default([]),
  requireApproval: z.boolean().default(true),
  replayUrl: z.string().nullable().optional().refine((u) => !u || validateWebinarReplayUrl(u).valid, {
    message: "Replay URL must be a valid HTTPS URL",
  }),
  published: z.boolean().default(true),
};

export const adminWebinarCreateSchema = z.discriminatedUnion("meetingProvider", [
  z.object({
    ...baseWebinarFields,
    meetingProvider: z.literal("google_meet"),
    meetingUrl: z.string().refine((u) => validateWebinarMeetingUrl("google_meet", u).valid, {
      message: "Invalid Google Meet URL (must be https://meet.google.com/...)",
    }),
    location: z.string().nullable().optional(),
  }),
  z.object({
    ...baseWebinarFields,
    meetingProvider: z.literal("teams"),
    meetingUrl: z.string().refine((u) => validateWebinarMeetingUrl("teams", u).valid, {
      message: "Invalid Microsoft Teams URL (must be https://teams.microsoft.com/... or https://teams.live.com/...)",
    }),
    location: z.string().nullable().optional(),
  }),
  z.object({
    ...baseWebinarFields,
    meetingProvider: z.literal("zoom"),
    meetingUrl: z.string().refine((u) => validateWebinarMeetingUrl("zoom", u).valid, {
      message: "Invalid Zoom URL (must be https://*.zoom.us/...)",
    }),
    location: z.string().nullable().optional(),
  }),
  z.object({
    ...baseWebinarFields,
    meetingProvider: z.literal("custom"),
    meetingUrl: z.string().refine((u) => validateWebinarMeetingUrl("custom", u).valid, {
      message: "Invalid custom URL (must be valid HTTPS URL without credentials)",
    }),
    location: z.string().nullable().optional(),
  }),
  z.object({
    ...baseWebinarFields,
    meetingProvider: z.literal("in_person"),
    meetingUrl: z.null().optional(),
    location: z.string().trim().min(2, "Location is required for in-person sessions").max(500),
  }),
]);

export type AdminWebinarCreateInput = z.infer<typeof adminWebinarCreateSchema>;
