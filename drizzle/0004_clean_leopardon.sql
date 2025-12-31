CREATE TABLE "crdt_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"binary" varchar(1048576) NOT NULL,
	"sync_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crdt_documents" ADD CONSTRAINT "crdt_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crdt_documents_user_entity_idx" ON "crdt_documents" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "crdt_documents_entity_type_idx" ON "crdt_documents" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "crdt_documents_sync_version_idx" ON "crdt_documents" USING btree ("user_id","sync_version");