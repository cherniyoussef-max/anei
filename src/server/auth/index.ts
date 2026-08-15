import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { oneTap } from "better-auth/plugins";
import { db } from "@/server/db";
import { account, rateLimit, session, user, verification } from "@/server/db/schema";
import { env, googleAuthConfigured, isLocalProductionSmoke } from "@/server/env";
import { enforceNewUserDefaults } from "@/server/auth/policy";
import { sendResetEmail, sendVerificationEmail } from "@/server/services/mailer";
import { ensurePrimaryPersonaMembership } from "@/server/services/personas";

export const auth = betterAuth({
  appName: "Académie Nationale de l’Éducation Inclusive",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, rateLimit },
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (data) => ({ data: enforceNewUserDefaults(data) }),
        after: async (created) => {
          const profileType = typeof created.profileType === "string" ? created.profileType : "learner";
          await ensurePrimaryPersonaMembership(created.id, profileType);
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: ["USER", "ADMIN", "SUPER_ADMIN"],
        required: false,
        defaultValue: "USER",
        input: false,
      },
      locale: {
        type: ["fr", "ar"],
        required: false,
        defaultValue: "fr",
      },
      profileType: {
        type: ["learner", "teacher", "avs", "parent", "specialist", "institution"],
        required: false,
        defaultValue: "learner",
      },
    },
    changeEmail: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user: authUser, url }) => {
      const locale = (authUser as { locale?: string }).locale === "ar" ? "ar" : "fr";
      await sendResetEmail({ name: authUser.name, email: authUser.email, url, locale });
    },
  },
  emailVerification: {
    sendOnSignUp: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: authUser, url }) => {
      const locale = (authUser as { locale?: string }).locale === "ar" ? "ar" : "fr";
      await sendVerificationEmail({ name: authUser.name, email: authUser.email, url, locale });
    },
  },
  socialProviders: googleAuthConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  plugins: googleAuthConfigured ? [oneTap()] : [],
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      disableImplicitLinking: false,
      requireLocalEmailVerified: true,
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 120,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-in/social": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 5 },
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
    useSecureCookies: env.NODE_ENV === "production" && !isLocalProductionSmoke,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
