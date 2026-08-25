import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { referralCode, referralConversion, user } from "@/server/db/schema";

function normalizeReferralCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9-]{4,64}$/.test(code) ? code : null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
function generateCode(length = 8) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

/** Lazily creates the caller's referral code on first visit to the referral page. Idempotent under concurrency via the unique (userId) index + a bounded retry on a code collision. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const [existing] = await db.select({ code: referralCode.code }).from(referralCode).where(eq(referralCode.userId, userId)).limit(1);
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    try {
      const [created] = await db.insert(referralCode).values({ userId, code }).onConflictDoNothing({ target: referralCode.userId }).returning({ code: referralCode.code });
      if (created) return created.code;
      const [row] = await db.select({ code: referralCode.code }).from(referralCode).where(eq(referralCode.userId, userId)).limit(1);
      if (row) return row.code;
    } catch {
      // Unique code collision (referral_code_code_unique) — retry with a new random code.
    }
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

export async function getReferralConversions(userId: string) {
  const [code] = await db.select({ id: referralCode.id }).from(referralCode).where(eq(referralCode.userId, userId)).limit(1);
  if (!code) return [];
  return db.select({
    id: referralConversion.id,
    status: referralConversion.status,
    createdAt: referralConversion.createdAt,
    referredName: user.name,
  }).from(referralConversion)
    .innerJoin(user, eq(referralConversion.referredUserId, user.id))
    .where(and(eq(referralConversion.referralCodeId, code.id)))
    .orderBy(desc(referralConversion.createdAt));
}

/** Records a valid third-party referral once. Unknown, malformed, self, and replayed codes are safe no-ops. */
export async function captureReferralAtSignup(referredUserId: string, rawCode: string): Promise<void> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return;

  const [ownerCode] = await db
    .select({ id: referralCode.id, userId: referralCode.userId })
    .from(referralCode)
    .where(eq(referralCode.code, code))
    .limit(1);
  if (!ownerCode || ownerCode.userId === referredUserId) return;

  await db
    .insert(referralConversion)
    .values({ referralCodeId: ownerCode.id, referredUserId, status: "PENDING" })
    .onConflictDoNothing({ target: referralConversion.referredUserId });
}
