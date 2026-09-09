ALTER TABLE "decks" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_parent_id_decks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decks_parent_id_idx" ON "decks" USING btree ("parent_id");