-- Rollback for Migration 0035: webinar_access_code_hash
-- Note: SHA-256 hashes are cryptographically one-way and cannot be mathematically reversed to plaintext.
-- Registrations with hashed codes must use newly issued codes or join tokens.
DO $$ BEGIN
  -- No-op: one-way hashes cannot be un-hashed
  NULL;
END $$;
