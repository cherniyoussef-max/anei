import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db, pool } from "../src/server/db";
import { account, user } from "../src/server/db/schema";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const email = requiredEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const password = requiredEnv("BOOTSTRAP_ADMIN_PASSWORD");
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "ANEI Super Admin";

if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
if (password.length < 15) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 15 characters.");
if (/DemoAdmin|change-me|password/i.test(password)) throw new Error("Refusing an obvious/default administrator password.");

async function main() {
  let [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!existing) {
    const result = await auth.api.signUpEmail({
      body: { name, email, password, locale: "fr", profileType: "institution" },
    });
    if (!result.user) throw new Error("Unable to create bootstrap administrator.");
    [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  }
  if (!existing) throw new Error("Administrator account was not found after creation.");

  // An account that previously signed up via a social provider (e.g. Google)
  // has no credential row, so it cannot use password + OTP login locally.
  // Link one idempotently: only when missing, never overwriting a password
  // an operator may already rely on.
  const [credentialAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, existing.id), eq(account.providerId, "credential")))
    .limit(1);
  if (!credentialAccount) {
    const context = await auth.$context;
    const hashedPassword = await context.password.hash(password);
    await context.internalAdapter.linkAccount({
      accountId: existing.id,
      providerId: "credential",
      userId: existing.id,
      password: hashedPassword,
    });
  }

  await db
    .update(user)
    .set({ role: "SUPER_ADMIN", emailVerified: true, updatedAt: new Date() })
    .where(eq(user.id, existing.id));
  console.log(`Super administrator ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => pool.end());
