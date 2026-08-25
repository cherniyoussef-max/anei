-- Adds a difficulty level to library resources, mirroring courses.level.

ALTER TABLE "resources" ADD COLUMN "level" text NOT NULL DEFAULT 'beginner';
ALTER TABLE "resources" ADD CONSTRAINT "resources_level_check" CHECK ("level" in ('beginner','intermediate','advanced'));
