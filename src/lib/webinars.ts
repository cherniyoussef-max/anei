export type WebinarMeetingProvider = "google_meet" | "teams" | "zoom" | "custom" | "in_person";

export type WebinarFormFieldType = "text" | "textarea" | "select" | "phone";

export interface WebinarFormFieldOption {
  value: string;
  labelFr: string;
  labelAr: string;
}

export interface WebinarFormField {
  id: string;
  labelFr: string;
  labelAr: string;
  type: WebinarFormFieldType;
  required: boolean;
  options?: WebinarFormFieldOption[];
  placeholderFr?: string;
  placeholderAr?: string;
}

export const DEFAULT_WEBINAR_FORM_FIELDS: WebinarFormField[] = [
  {
    id: "phone",
    labelFr: "Numéro de téléphone",
    labelAr: "رقم الهاتف",
    type: "phone",
    required: true,
    placeholderFr: "+216 XX XXX XXX",
    placeholderAr: "+216 XX XXX XXX",
  },
  {
    id: "role",
    labelFr: "Votre profil ou fonction",
    labelAr: "صفتك أو مهنتك",
    type: "select",
    required: true,
    options: [
      { value: "teacher", labelFr: "Enseignant / Professeur", labelAr: "معلم / أستاذ" },
      { value: "avs", labelFr: "AVS / Accompagnant(e)", labelAr: "مرافق حياة مدرسية AVS" },
      { value: "parent", labelFr: "Parent d'élève", labelAr: "ولي أمر" },
      { value: "specialist", labelFr: "Orthophoniste / Psychologue / Spécialiste", labelAr: "أخصائي / تقويم نطق / نفساني" },
      { value: "director", labelFr: "Direction / Cadre éducatif", labelAr: "مدير / إطار تربوي" },
      { value: "other", labelFr: "Autre profil", labelAr: "صفة أخرى" },
    ],
  },
  {
    id: "organization",
    labelFr: "Établissement scolaire / Structure",
    labelAr: "المؤسسة التربوية / الهيكل",
    type: "text",
    required: false,
    placeholderFr: "Ex: École primaire, Collège...",
    placeholderAr: "مثال: مدرسة ابتدائية، معهد...",
  },
  {
    id: "expectations",
    labelFr: "Vos questions ou attentes pour l'intervenant",
    labelAr: "أسئلتك أو تطلعاتك من الندوة",
    type: "textarea",
    required: false,
    placeholderFr: "Posez votre question à l'expert...",
    placeholderAr: "اطرح سؤالك على المحاضر...",
  },
];

import crypto from "node:crypto";

/**
 * Generates a unique, cryptographically secure one-time access pass code.
 * Uses CSPRNG with 128 bits of entropy (16 bytes).
 * Example: "MEET-A1B2C3D4-E5F67890-12345678-90ABCDEF"
 */
export function generateAccessCode(prefix = "MEET"): string {
  const hex = crypto.randomBytes(16).toString("hex").toUpperCase();
  return `${prefix}-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`;
}

/**
 * Computes deterministic SHA-256 hash of an access code for secure database storage.
 */
export function hashAccessCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export interface WebinarProviderMeta {
  id: WebinarMeetingProvider;
  name: string;
  nameAr: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconName: "video" | "google" | "teams" | "map";
  helperUrl: string;
  helperLabel: string;
}

export const WEBINAR_PROVIDERS: Record<WebinarMeetingProvider, WebinarProviderMeta> = {
  google_meet: {
    id: "google_meet",
    name: "Google Meet",
    nameAr: "جوجل ميت",
    badgeBg: "rgba(0, 172, 71, 0.12)",
    badgeText: "#00796B",
    badgeBorder: "rgba(0, 172, 71, 0.3)",
    iconName: "google",
    helperUrl: "https://meet.google.com/new",
    helperLabel: "Créer une réunion Google Meet",
  },
  teams: {
    id: "teams",
    name: "Microsoft Teams",
    nameAr: "مايكروسوفت تيمز",
    badgeBg: "rgba(80, 89, 201, 0.12)",
    badgeText: "#5059C9",
    badgeBorder: "rgba(80, 89, 201, 0.3)",
    iconName: "teams",
    helperUrl: "https://teams.microsoft.com/",
    helperLabel: "Ouvrir Microsoft Teams",
  },
  zoom: {
    id: "zoom",
    name: "Zoom",
    nameAr: "زووم",
    badgeBg: "rgba(45, 140, 255, 0.12)",
    badgeText: "#0B5CFF",
    badgeBorder: "rgba(45, 140, 255, 0.3)",
    iconName: "video",
    helperUrl: "https://zoom.us/start/videomeeting",
    helperLabel: "Démarrer une réunion Zoom",
  },
  custom: {
    id: "custom",
    name: "Lien direct",
    nameAr: "رابط مباشر",
    badgeBg: "rgba(8, 45, 85, 0.08)",
    badgeText: "#082d55",
    badgeBorder: "rgba(8, 45, 85, 0.2)",
    iconName: "video",
    helperUrl: "",
    helperLabel: "",
  },
  in_person: {
    id: "in_person",
    name: "En présentiel",
    nameAr: "حضوري",
    badgeBg: "rgba(234, 88, 12, 0.12)",
    badgeText: "#c2410c",
    badgeBorder: "rgba(234, 88, 12, 0.3)",
    iconName: "map",
    helperUrl: "",
    helperLabel: "",
  },
};

export function getProviderMeta(provider?: string | null): WebinarProviderMeta {
  if (provider) {
    const normalized = provider.toLowerCase().trim().replace(/[-\s]+/g, "_");
    if (normalized === "google_meet" || normalized === "google" || normalized === "meet") {
      return WEBINAR_PROVIDERS.google_meet;
    }
    if (normalized === "teams" || normalized === "microsoft_teams") {
      return WEBINAR_PROVIDERS.teams;
    }
    if (normalized === "zoom") {
      return WEBINAR_PROVIDERS.zoom;
    }
    if (normalized === "in_person" || normalized === "inperson" || normalized === "presentiel") {
      return WEBINAR_PROVIDERS.in_person;
    }
    if (normalized === "custom" || normalized === "direct") {
      return WEBINAR_PROVIDERS.custom;
    }
    if (normalized in WEBINAR_PROVIDERS) {
      return WEBINAR_PROVIDERS[normalized as WebinarMeetingProvider];
    }
  }
  return WEBINAR_PROVIDERS.google_meet;
}

export function getProviderLabel(provider?: string | null, locale: "fr" | "ar" = "fr"): string {
  const meta = getProviderMeta(provider);
  return locale === "ar" ? meta.nameAr : meta.name;
}

/**
 * Generates an instant Google Calendar event creation URL.
 */
export function buildGoogleCalendarUrl(input: {
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  meetingUrl?: string | null;
  location?: string | null;
}): string {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + (input.durationMinutes || 60) * 60000);

  const formatGCalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const safeMeetingUrl =
    input.meetingUrl && input.meetingUrl.startsWith("https://") ? input.meetingUrl : undefined;

  const safeLocation = (input.location || safeMeetingUrl || "En ligne (Webinaire ANEI)").slice(0, 250);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
    details: `${input.description}\n\n${safeMeetingUrl ? `Lien de connexion direct :\n${safeMeetingUrl}` : safeLocation}`,
    location: safeLocation,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates RFC 5545 compliant iCalendar content (.ics) for Outlook, Teams, and Apple Calendar.
 */
export function generateIcsCalendar(input: {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  meetingUrl?: string | null;
  location?: string | null;
  organizerName?: string;
  organizerEmail?: string;
}): string {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + (input.durationMinutes || 60) * 60000);
  const now = new Date();

  const formatIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const safeMeetingUrl =
    input.meetingUrl && input.meetingUrl.startsWith("https://") ? input.meetingUrl : undefined;

  const cleanSummary = input.title.replace(/\r?\n/g, " ");
  const cleanDescription = (
    input.description + (safeMeetingUrl ? `\\n\\nLien de connexion : ${safeMeetingUrl}` : "")
  )
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
  const cleanLocation = (input.location || safeMeetingUrl || "En ligne (Webinaire ANEI)").replace(/,/g, "\\,");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ANEI Academy//Webinars//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:webinar-${input.id}@anei.education`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${cleanSummary}`,
    `DESCRIPTION:${cleanDescription}`,
    `LOCATION:${cleanLocation}`,
    safeMeetingUrl ? `URL:${safeMeetingUrl}` : "",
    "ORGANIZER;CN=Académie ANEI:mailto:contact@anei.education",
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Rappel : ${cleanSummary} commence dans 15 minutes`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export * from "./webinar-validation";
