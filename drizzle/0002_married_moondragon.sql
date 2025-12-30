CREATE TABLE "note_field_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_type_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"order" integer NOT NULL,
	"field_type" varchar(50) DEFAULT 'text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"note_field_type_id" uuid NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"front_template" text NOT NULL,
	"back_template" text NOT NULL,
	"is_reversible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"note_type_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sync_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "note_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "is_reversed" boolean;--> statement-breakpoint
ALTER TABLE "note_field_types" ADD CONSTRAINT "note_field_types_note_type_id_note_types_id_fk" FOREIGN KEY ("note_type_id") REFERENCES "public"."note_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_field_values" ADD CONSTRAINT "note_field_values_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_field_values" ADD CONSTRAINT "note_field_values_note_field_type_id_note_field_types_id_fk" FOREIGN KEY ("note_field_type_id") REFERENCES "public"."note_field_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_types" ADD CONSTRAINT "note_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_note_type_id_note_types_id_fk" FOREIGN KEY ("note_type_id") REFERENCES "public"."note_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;