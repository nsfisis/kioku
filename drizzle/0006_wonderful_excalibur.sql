ALTER TABLE "cards" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "note_field_types" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "note_field_values" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "note_types" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "review_logs" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "crdt_documents" ALTER COLUMN "sync_version" SET DEFAULT 1;--> statement-breakpoint
-- Backfill rows created by the pre-offline-first REST endpoints, which never set
-- sync_version and so left it at the old default of 0. Clients pull rows with
-- `sync_version > lastSyncVersion`, so those rows never reached any client.
--
-- sync_version is a per-row revision counter, while lastSyncVersion is the
-- highest version a client has seen across every entity. Lifting these rows to
-- 1 would therefore still hide them from a client whose watermark has already
-- moved past 1, so lift them above every version currently in the database.
DO $$
DECLARE
	next_version integer;
BEGIN
	SELECT GREATEST(
		(SELECT COALESCE(MAX(sync_version), 0) FROM "note_types"),
		(SELECT COALESCE(MAX(sync_version), 0) FROM "note_field_types"),
		(SELECT COALESCE(MAX(sync_version), 0) FROM "decks"),
		(SELECT COALESCE(MAX(sync_version), 0) FROM "notes"),
		(SELECT COALESCE(MAX(sync_version), 0) FROM "note_field_values"),
		(SELECT COALESCE(MAX(sync_version), 0) FROM "cards"),
		(SELECT COALESCE(MAX(sync_version), 0) FROM "review_logs"),
		(SELECT COALESCE(MAX(sync_version), 0) FROM "crdt_documents")
	) + 1 INTO next_version;

	UPDATE "note_types" SET "sync_version" = next_version WHERE "sync_version" = 0;
	UPDATE "note_field_types" SET "sync_version" = next_version WHERE "sync_version" = 0;
	UPDATE "decks" SET "sync_version" = next_version WHERE "sync_version" = 0;
	UPDATE "notes" SET "sync_version" = next_version WHERE "sync_version" = 0;
	UPDATE "note_field_values" SET "sync_version" = next_version WHERE "sync_version" = 0;
	UPDATE "cards" SET "sync_version" = next_version WHERE "sync_version" = 0;
	UPDATE "review_logs" SET "sync_version" = next_version WHERE "sync_version" = 0;
	UPDATE "crdt_documents" SET "sync_version" = next_version WHERE "sync_version" = 0;
END $$;
