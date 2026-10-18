import "server-only";
import { eq, or, sql, and, ne } from "drizzle-orm";
import type { db as dbType } from "@/server/db";
import { user, avsProfiles } from "@/server/db/schema";
import {
  validateAndNormalizeCanonicalEmail,
  validateAndNormalizeTunisianPhone,
  type EmailErrorCode,
  type PhoneErrorCode,
} from "@/lib/auth/canonical-identity";

export * from "@/lib/auth/canonical-identity";

/**
 * Verifies identity availability in the PostgreSQL database.
 * Checks both `user` table (email and phone) and `avs_profiles` (contactPhone).
 */
export async function checkIdentityAvailability(
  dbInstance: typeof dbType,
  options: {
    email?: string | null;
    phone?: string | null;
    excludeUserId?: string | null;
  },
): Promise<{
  emailAvailable: boolean;
  emailNormalized: string;
  emailErrorCode: EmailErrorCode | null;
  phoneAvailable: boolean;
  phoneNormalized: string;
  phoneErrorCode: PhoneErrorCode | null;
}> {
  let emailAvailable = true;
  let emailNormalized = "";
  let emailErrorCode: EmailErrorCode | null = null;

  let phoneAvailable = true;
  let phoneNormalized = "";
  let phoneErrorCode: PhoneErrorCode | null = null;

  // 1. Check Email
  if (options.email && options.email.trim()) {
    const emailResult = validateAndNormalizeCanonicalEmail(options.email);
    emailNormalized = emailResult.canonicalEmail;

    if (!emailResult.success) {
      emailAvailable = false;
      emailErrorCode = emailResult.error;
    } else {
      const isGmail = emailResult.domain === "gmail.com";
      const conditions = [
        eq(user.email, emailResult.canonicalEmail),
        sql`LOWER(${user.email}) = LOWER(${emailResult.canonicalEmail})`,
      ];

      if (isGmail) {
        // Match any existing gmail address regardless of dots or plus tags
        conditions.push(
          sql`SPLIT_PART(LOWER(${user.email}), '@', 2) IN ('gmail.com', 'googlemail.com') AND REPLACE(SPLIT_PART(SPLIT_PART(LOWER(${user.email}), '@', 1), '+', 1), '.', '') = ${emailResult.localPart}`,
        );
      }

      const emailQuery = dbInstance
        .select({ id: user.id })
        .from(user)
        .where(
          options.excludeUserId
            ? and(or(...conditions), ne(user.id, options.excludeUserId))
            : or(...conditions),
        )
        .limit(1);

      const existingUsers = await emailQuery;
      if (existingUsers.length > 0) {
        emailAvailable = false;
        emailErrorCode = "EMAIL_TAKEN";
      }
    }
  }

  // 2. Check Phone
  if (options.phone && options.phone.trim()) {
    const phoneResult = validateAndNormalizeTunisianPhone(options.phone);
    phoneNormalized = phoneResult.canonicalPhone;

    if (!phoneResult.success) {
      phoneAvailable = false;
      phoneErrorCode = phoneResult.error;
    } else {
      const canonicalPhone = phoneResult.canonicalPhone;
      const digits8 = phoneResult.nationalDigits;

      // Check `user.phone`
      const userConditions = [
        eq(user.phone, canonicalPhone),
        sql`RIGHT(REGEXP_REPLACE(COALESCE(${user.phone}, ''), '\\D', '', 'g'), 8) = ${digits8}`,
      ];

      const existingPhoneUser = await dbInstance
        .select({ id: user.id })
        .from(user)
        .where(
          options.excludeUserId
            ? and(or(...userConditions), ne(user.id, options.excludeUserId))
            : or(...userConditions),
        )
        .limit(1);

      if (existingPhoneUser.length > 0) {
        phoneAvailable = false;
        phoneErrorCode = "PHONE_TAKEN";
      } else {
        // Also check `avs_profiles.contactPhone` and `avs_profiles.phone`
        const avsConditions = [
          eq(avsProfiles.contactPhone, canonicalPhone),
          eq(avsProfiles.phone, canonicalPhone),
          sql`RIGHT(REGEXP_REPLACE(COALESCE(${avsProfiles.contactPhone}, ''), '\\D', '', 'g'), 8) = ${digits8}`,
          sql`RIGHT(REGEXP_REPLACE(COALESCE(${avsProfiles.phone}, ''), '\\D', '', 'g'), 8) = ${digits8}`,
        ];

        const existingAvs = await dbInstance
          .select({ id: avsProfiles.id })
          .from(avsProfiles)
          .where(
            options.excludeUserId
              ? and(or(...avsConditions), ne(avsProfiles.userId, options.excludeUserId))
              : or(...avsConditions),
          )
          .limit(1);

        if (existingAvs.length > 0) {
          phoneAvailable = false;
          phoneErrorCode = "PHONE_TAKEN";
        }
      }
    }
  }

  return {
    emailAvailable,
    emailNormalized,
    emailErrorCode,
    phoneAvailable,
    phoneNormalized,
    phoneErrorCode,
  };
}
