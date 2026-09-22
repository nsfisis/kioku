CREATE SEQUENCE "public"."sync_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "note_field_types" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "note_field_values" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "note_types" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "review_logs" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "crdt_documents" ALTER COLUMN "sync_version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
-- sync_version used to be a per-row revision counter (1 on insert, +1 on every
-- update), while pull treats it as a global cursor: clients ask for rows with
-- `sync_version > lastSyncVersion` and then store the highest version they
-- received. A row created after another row had been edited a few times
-- started below that watermark and never reached clients that had already
-- pulled.
--
-- From now on every write takes its version from sync_version_seq. Existing
-- versions cannot be trusted, and some rows are already missing from clients
-- whose watermark moved past them, so renumber every row with a value above
-- the highest version currently stored anywhere. Every client pulls every row
-- once more, which delivers the rows it skipped.
DO $$
DECLARE
	max_version integer;
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
	) INTO max_version;

	PERFORM setval('sync_version_seq', max_version + 1, false);

	UPDATE "note_types" SET "sync_version" = nextval('sync_version_seq');
	UPDATE "note_field_types" SET "sync_version" = nextval('sync_version_seq');
	UPDATE "decks" SET "sync_version" = nextval('sync_version_seq');
	UPDATE "notes" SET "sync_version" = nextval('sync_version_seq');
	UPDATE "note_field_values" SET "sync_version" = nextval('sync_version_seq');
	UPDATE "cards" SET "sync_version" = nextval('sync_version_seq');
	UPDATE "review_logs" SET "sync_version" = nextval('sync_version_seq');
	UPDATE "crdt_documents" SET "sync_version" = nextval('sync_version_seq');
END $$;
