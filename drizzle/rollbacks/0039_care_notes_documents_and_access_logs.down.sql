-- Rollback for Migration 0039: Care Session Notes, Shared Documents, and Care Access Logs

DROP TABLE IF EXISTS "care_access_log" CASCADE;
DROP TABLE IF EXISTS "care_document" CASCADE;
DROP TABLE IF EXISTS "specialist_session_note" CASCADE;
