import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import { account, personaMembership, user } from "../src/server/db/schema";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || process.argv[2]?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.argv[3];

  if (!email) {
    console.error("Usage: tsx scripts/set-admin-password.ts <email> [password]");
    process.exit(1);
  }

  const [existingUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!existingUser) {
    console.error(`User ${email} not found.`);
    process.exit(1);
  }

  // Ensure role is SUPER_ADMIN, profile_type is institution, and email is verified
  await db
    .update(user)
    .set({
      role: "SUPER_ADMIN",
      profileType: "institution",
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.id, existingUser.id));

  // Remove any learner/student persona membership
  await db
    .delete(personaMembership)
    .where(and(eq(personaMembership.userId, existingUser.id), eq(personaMembership.persona, "STUDENT")));

  if (password) {
    const context = await auth.$context;
    const hashedPassword = await context.password.hash(password);

    const [existingAccount] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, existingUser.id), eq(account.providerId, "credential")))
      .limit(1);

    if (existingAccount) {
      await db
        .update(account)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(account.id, existingAccount.id));
    } else {
      await context.internalAdapter.linkAccount({
        accountId: existingUser.id,
        providerId: "credential",
        userId: existingUser.id,
        password: hashedPassword,
      });
    }
    console.log(`Updated password and confirmed SUPER_ADMIN role for: ${email}`);
  } else {
    console.log(`Confirmed SUPER_ADMIN role for: ${email} (password unchanged)`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
