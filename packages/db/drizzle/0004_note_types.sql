CREATE TABLE "note_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'basic' NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"builtin_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"is_sort" boolean DEFAULT false NOT NULL,
	"editor_opts" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"qfmt" text DEFAULT '' NOT NULL,
	"afmt" text DEFAULT '' NOT NULL,
	"deck_override_id" uuid
);
--> statement-breakpoint
CREATE TABLE "collection_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"field_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "collection_note_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "template_ord" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "cloze_ord" integer DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "buried_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "note_models" ADD CONSTRAINT "note_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_fields" ADD CONSTRAINT "model_fields_model_id_note_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."note_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_model_id_note_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."note_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_deck_override_id_decks_id_fk" FOREIGN KEY ("deck_override_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_notes" ADD CONSTRAINT "collection_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_notes" ADD CONSTRAINT "collection_notes_model_id_note_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."note_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_notes" ADD CONSTRAINT "collection_notes_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_collection_note_id_collection_notes_id_fk" FOREIGN KEY ("collection_note_id") REFERENCES "public"."collection_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_models_user_id_idx" ON "note_models" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "note_models_user_slug_idx" ON "note_models" USING btree ("user_id","builtin_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "model_fields_model_ord_idx" ON "model_fields" USING btree ("model_id","ord");--> statement-breakpoint
CREATE UNIQUE INDEX "card_templates_model_ord_idx" ON "card_templates" USING btree ("model_id","ord");--> statement-breakpoint
CREATE INDEX "collection_notes_user_id_idx" ON "collection_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collection_notes_deck_id_idx" ON "collection_notes" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "collection_notes_model_id_idx" ON "collection_notes" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_user_hash_idx" ON "media_assets" USING btree ("user_id","content_hash");--> statement-breakpoint
CREATE INDEX "media_assets_user_id_idx" ON "media_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cards_collection_note_id_idx" ON "cards" USING btree ("collection_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_collection_note_slot_idx" ON "cards" USING btree ("collection_note_id","template_ord","cloze_ord");
