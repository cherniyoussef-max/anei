-- Migration 0035: Hash existing plain access codes with SHA-256 for secure storage
UPDATE "webinar_registrations"
SET "access_code" = encode(sha256(UPPER(TRIM("access_code"))::bytea), 'hex')
WHERE "access_code" IS NOT NULL
  AND length("access_code") != 64;
