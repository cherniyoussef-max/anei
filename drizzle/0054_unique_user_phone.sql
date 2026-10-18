CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_unique" ON "user" ("phone") WHERE "phone" IS NOT NULL AND "phone" != '';
