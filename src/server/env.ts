import { z } from "zod";
import { isGoogleAuthConfigured } from "@/server/auth/google-config";

const boolString = z.string().optional().transform((value) => value === "true");
const optionalTrimmed = z.string().optional().transform((value) => value?.trim() || undefined);
const csvOrigins = z.string().optional().transform((value) =>
  (value ?? "").split(",").map((item) => item.trim()).filter(Boolean),
);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32).default("development-only-secret-change-me-123456789"),
  TRUSTED_ORIGINS: csvOrigins,
  TRUST_PROXY_HEADERS: boolString,
  AUTH_REQUIRE_EMAIL_VERIFICATION: boolString,
  ENABLE_GOOGLE_AUTH: boolString,
  ENABLE_FLOUCI: boolString,
  ENABLE_CLICTOPAY: boolString,
  ENABLE_AI: boolString,
  ENABLE_WHATSAPP: boolString,
  ENABLE_ADMIN_MFA: boolString,
  DATABASE_URL: z.string().min(1).default("postgresql://anei:anei@localhost:5432/anei"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
  GOOGLE_CLIENT_ID: optionalTrimmed,
  GOOGLE_CLIENT_SECRET: optionalTrimmed,
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: boolString,
  SMTP_USER: optionalTrimmed,
  SMTP_PASS: optionalTrimmed,
  SMTP_FROM: z.string().default("ANEI <no-reply@anei.local>"),
  REDIS_URL: optionalTrimmed,
  FLOUCI_PUBLIC_KEY: optionalTrimmed,
  FLOUCI_PRIVATE_KEY: optionalTrimmed,
  FLOUCI_BASE_URL: z.string().url().default("https://developers.flouci.com"),
  FLOUCI_ACCEPT_CARD: boolString,
  PAYMENT_ALLOW_MOCK: boolString,
  CLICKTOPAY_MERCHANT_ID: optionalTrimmed,
  CLICKTOPAY_TERMINAL_ID: optionalTrimmed,
  CLICKTOPAY_API_URL: optionalTrimmed,
  CLICKTOPAY_API_KEY: optionalTrimmed,
  CLICKTOPAY_RETURN_URL: z.string().url().default("http://localhost:3000/fr/paiement/retour"),
  PAYMENT_DEFAULT_PROVIDER: z.enum(["mock", "flouci", "clicktopay"]).default("mock"),
  CONTACT_EMAIL: z.string().email().default("contact@anei.local"),
  CONTACT_PHONE: optionalTrimmed,
  CONTACT_ADDRESS: z.string().default("Tunis, Tunisie"),
  SECURITY_CONTACT_EMAIL: z.string().email().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SEED_DEMO_DATA: boolString,
  STORAGE_PROVIDER: z.enum(["local", "s3-compatible"]).default("local"),
  STORAGE_BUCKET: optionalTrimmed,
  STORAGE_ENDPOINT: optionalTrimmed,
  STORAGE_REGION: optionalTrimmed,
  STORAGE_FORCE_PATH_STYLE: boolString,
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  STORAGE_MEDIA_URL_TTL_SECONDS: z.coerce.number().int().min(300).max(14400).default(7200),
  STORAGE_ACCESS_KEY_ID: optionalTrimmed,
  STORAGE_SECRET_ACCESS_KEY: optionalTrimmed,
  WHATSAPP_ACCESS_TOKEN: optionalTrimmed,
  WHATSAPP_APP_SECRET: optionalTrimmed,
  WHATSAPP_VERIFY_TOKEN: optionalTrimmed,
  WHATSAPP_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v22.0"),
  WHATSAPP_API_BASE_URL: z.string().url().default("https://graph.facebook.com"),
  ENABLE_CLOUDFLARE_STREAM: boolString,
  CLOUDFLARE_ACCOUNT_ID: optionalTrimmed,
  CLOUDFLARE_STREAM_API_TOKEN: optionalTrimmed,
  CLOUDFLARE_STREAM_CUSTOMER_CODE: optionalTrimmed,
  OPENAI_API_KEY: optionalTrimmed,
  OPENAI_API_BASE_URL: optionalTrimmed,
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
});

const parsed = schema.parse(process.env);
const isBuildPhase = process.env.ANEI_BUILD_PHASE === "1";
export const isLocalProductionSmoke = process.env.ANEI_LOCAL_PRODUCTION === "1";
const origins = Array.from(new Set([parsed.APP_URL, ...parsed.TRUSTED_ORIGINS]));

export const env = { ...parsed, TRUSTED_ORIGINS: origins };

function isLocalUrl(value: string) {
  const host = new URL(value).hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isLocalDatabaseUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

if (env.NODE_ENV === "production" && isLocalProductionSmoke) {
  if (!isLocalUrl(env.APP_URL) || !isLocalUrl(env.BETTER_AUTH_URL)) {
    throw new Error("ANEI_LOCAL_PRODUCTION may only be used with loopback APP_URL/BETTER_AUTH_URL values.");
  }
  if (!isLocalDatabaseUrl(env.DATABASE_URL)) {
    throw new Error("ANEI_LOCAL_PRODUCTION may only be used with a loopback PostgreSQL connection.");
  }
  if (env.TRUSTED_ORIGINS.some((origin) => !isLocalUrl(origin))) {
    throw new Error("ANEI_LOCAL_PRODUCTION may only trust loopback origins.");
  }
}

// `next build` evaluates server modules while creating the artifact. Deployment-only
// requirements belong to runtime startup, not artifact compilation. The build wrapper
// sets ANEI_BUILD_PHASE=1; the normal production start command does not.
if (env.NODE_ENV === "production" && !isBuildPhase && !isLocalProductionSmoke) {
  if (env.BETTER_AUTH_SECRET.startsWith("development-only") || env.BETTER_AUTH_SECRET.length < 48) {
    throw new Error("BETTER_AUTH_SECRET must be a strong production secret of at least 48 characters.");
  }
  if (!process.env.DATABASE_URL || /postgresql:\/\/anei:anei@/i.test(env.DATABASE_URL)) {
    throw new Error("DATABASE_URL must be an explicit non-development database credential in production.");
  }
  if (!env.APP_URL.startsWith("https://") || !env.BETTER_AUTH_URL.startsWith("https://")) {
    throw new Error("APP_URL and BETTER_AUTH_URL must use HTTPS in production.");
  }
  if (env.TRUSTED_ORIGINS.some(isLocalUrl)) throw new Error("TRUSTED_ORIGINS must not contain localhost in production.");
  if (env.PAYMENT_ALLOW_MOCK || env.PAYMENT_DEFAULT_PROVIDER === "mock") {
    throw new Error("Mock payments are forbidden in production.");
  }
  if (!env.AUTH_REQUIRE_EMAIL_VERIFICATION) {
    throw new Error("AUTH_REQUIRE_EMAIL_VERIFICATION must be enabled in production.");
  }
  if (env.SMTP_HOST === "localhost" || env.SMTP_HOST === "127.0.0.1") {
    throw new Error("Production email verification requires a real SMTP/provider host, not localhost.");
  }
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("Production email verification requires SMTP_USER and SMTP_PASS.");
  }
  if (!process.env.SMTP_FROM || /@[^>\s]*\.local(?:>|\s|$)/i.test(env.SMTP_FROM)) {
    throw new Error("SMTP_FROM must be an explicit production sender on a real domain.");
  }
  if (!process.env.CONTACT_EMAIL || env.CONTACT_EMAIL.endsWith(".local")) {
    throw new Error("CONTACT_EMAIL must be an explicit production contact address on a real domain.");
  }
  if (!process.env.CONTACT_ADDRESS || env.CONTACT_ADDRESS.trim() === "Tunis, Tunisie") {
    throw new Error("CONTACT_ADDRESS must be an explicit academy-approved production value.");
  }
  if (env.SEED_DEMO_DATA) {
    throw new Error("SEED_DEMO_DATA must be false in production.");
  }
  if (env.ENABLE_GOOGLE_AUTH && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
    throw new Error("Google auth is enabled but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are missing.");
  }
  if (env.ENABLE_FLOUCI && (!env.FLOUCI_PUBLIC_KEY || !env.FLOUCI_PRIVATE_KEY)) {
    throw new Error("Flouci is enabled but FLOUCI_PUBLIC_KEY/FLOUCI_PRIVATE_KEY are missing.");
  }
  if (env.ENABLE_CLICTOPAY) {
    throw new Error("ClicToPay cannot be enabled until the merchant-specific adapter has been implemented and acceptance-tested.");
  }
  if (env.ENABLE_AI) {
    throw new Error("ENABLE_AI cannot be true in production until the AI provider/retrieval security implementation is complete.");
  }
  if (env.ENABLE_ADMIN_MFA) {
    throw new Error("ENABLE_ADMIN_MFA cannot be true until the supported MFA flow and recovery UX are implemented.");
  }
  if (env.PAYMENT_DEFAULT_PROVIDER === "flouci" && !env.ENABLE_FLOUCI) {
    throw new Error("Flouci is the default payment provider but ENABLE_FLOUCI is false.");
  }
  if (env.PAYMENT_DEFAULT_PROVIDER === "clicktopay") {
    throw new Error("ClicToPay cannot be the production default until the merchant-specific adapter is complete.");
  }
  if (env.STORAGE_PROVIDER === "local") {
    throw new Error("Production protected media requires STORAGE_PROVIDER=s3-compatible.");
  }
  if (env.STORAGE_PROVIDER === "s3-compatible" && (!env.STORAGE_BUCKET || !env.STORAGE_REGION || !env.STORAGE_ACCESS_KEY_ID || !env.STORAGE_SECRET_ACCESS_KEY)) {
    throw new Error("S3-compatible storage is selected but required storage configuration is incomplete.");
  }
  if (env.ENABLE_WHATSAPP && (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_APP_SECRET || !env.WHATSAPP_VERIFY_TOKEN)) {
    throw new Error("WhatsApp is enabled but WHATSAPP_ACCESS_TOKEN/WHATSAPP_APP_SECRET/WHATSAPP_VERIFY_TOKEN are missing.");
  }
  if (env.ENABLE_CLOUDFLARE_STREAM && (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAM_API_TOKEN || !env.CLOUDFLARE_STREAM_CUSTOMER_CODE)) {
    throw new Error("Cloudflare Stream is enabled but CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_STREAM_API_TOKEN/CLOUDFLARE_STREAM_CUSTOMER_CODE are missing.");
  }
}

export const googleAuthConfigured = isGoogleAuthConfigured({
  enabled: env.ENABLE_GOOGLE_AUTH,
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
});
export const flouciConfigured = Boolean(env.ENABLE_FLOUCI && env.FLOUCI_PUBLIC_KEY && env.FLOUCI_PRIVATE_KEY);
export const clickToPayConfigured = Boolean(
  env.ENABLE_CLICTOPAY && env.CLICKTOPAY_MERCHANT_ID && env.CLICKTOPAY_API_URL && env.CLICKTOPAY_API_KEY,
);
export const whatsappConfigured = Boolean(
  env.ENABLE_WHATSAPP && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_APP_SECRET && env.WHATSAPP_VERIFY_TOKEN,
);
export const cloudflareStreamConfigured = Boolean(
  env.ENABLE_CLOUDFLARE_STREAM && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_STREAM_API_TOKEN && env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
);
