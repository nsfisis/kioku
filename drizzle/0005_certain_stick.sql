ALTER TABLE "decks" ADD COLUMN "default_note_type_id" uuid;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_default_note_type_id_note_types_id_fk" FOREIGN KEY ("default_note_type_id") REFERENCES "public"."note_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" DROP COLUMN "new_cards_per_day";