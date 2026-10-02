import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: string }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value: string): Buffer {
    return Buffer.from(value, "hex");
  },
  toDriver(value: Buffer): string {
    return value.toString("hex");
  },
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Self-referencing parent for a folder-style hierarchy. NULL = top level.
    // Deleting a deck cascades to its descendants (and their cards).
    parentId: uuid("parent_id").references((): AnyPgColumn => decks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("decks_user_id_idx").on(table.userId),
    index("decks_parent_id_idx").on(table.parentId),
  ],
);

export const noteModels = pgTable(
  "note_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("basic"),
    css: text("css").notNull().default(""),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    builtinSlug: text("builtin_slug"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("note_models_user_id_idx").on(table.userId),
    uniqueIndex("note_models_user_slug_idx").on(table.userId, table.builtinSlug),
  ],
);

export const modelFields = pgTable(
  "model_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => noteModels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ord: integer("ord").notNull().default(0),
    isSort: boolean("is_sort").notNull().default(false),
    editorOpts: jsonb("editor_opts").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [uniqueIndex("model_fields_model_ord_idx").on(table.modelId, table.ord)],
);

export const cardTemplates = pgTable(
  "card_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => noteModels.id, { onDelete: "cascade" }),
    ord: integer("ord").notNull().default(0),
    name: text("name").notNull(),
    qfmt: text("qfmt").notNull().default(""),
    afmt: text("afmt").notNull().default(""),
    deckOverrideId: uuid("deck_override_id").references(() => decks.id, {
      onDelete: "set null",
    }),
  },
  (table) => [uniqueIndex("card_templates_model_ord_idx").on(table.modelId, table.ord)],
);

export const collectionNotes = pgTable(
  "collection_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: uuid("model_id")
      .notNull()
      .references(() => noteModels.id, { onDelete: "restrict" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    fieldValues: jsonb("field_values").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("collection_notes_user_id_idx").on(table.userId),
    index("collection_notes_deck_id_idx").on(table.deckId),
    index("collection_notes_model_id_idx").on(table.modelId),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("media_assets_user_hash_idx").on(table.userId, table.contentHash),
    index("media_assets_user_id_idx").on(table.userId),
  ],
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    collectionNoteId: uuid("collection_note_id").references(() => collectionNotes.id, {
      onDelete: "cascade",
    }),
    templateOrd: integer("template_ord").notNull().default(0),
    clozeOrd: integer("cloze_ord").notNull().default(-1),
    frontText: text("front_text").notNull().default(""),
    backText: text("back_text").notNull().default(""),
    frontPencilData: bytea("front_pencil_data"),
    backPencilData: bytea("back_pencil_data"),
    sourceNoteId: uuid("source_note_id").references((): AnyPgColumn => notes.id, {
      onDelete: "set null",
    }),
    sourcePageId: uuid("source_page_id").references((): AnyPgColumn => notePages.id, {
      onDelete: "set null",
    }),
    suspended: boolean("suspended").notNull().default(false),
    buriedUntil: timestamp("buried_until", { withTimezone: true }),
    flag: integer("flag").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("cards_deck_id_idx").on(table.deckId),
    index("cards_source_note_id_idx").on(table.sourceNoteId),
    index("cards_collection_note_id_idx").on(table.collectionNoteId),
    uniqueIndex("cards_collection_note_slot_idx").on(
      table.collectionNoteId,
      table.templateOrd,
      table.clozeOrd,
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tags_user_id_name_idx").on(table.userId, table.name)],
);

export const cardTags = pgTable(
  "card_tags",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.tagId] })],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: text("query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("saved_searches_user_id_idx").on(table.userId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notes_user_id_idx").on(table.userId),
    index("notes_deck_id_idx").on(table.deckId),
  ],
);

export const notePages = pgTable(
  "note_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    pageIndex: integer("page_index").notNull().default(0),
    paperStyle: text("paper_style").notNull().default("blank"),
    pencilData: bytea("pencil_data"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("note_pages_note_id_page_index_idx").on(table.noteId, table.pageIndex),
  ],
);

export const reviewStates = pgTable(
  "review_states",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    interval: integer("interval").notNull().default(0),
    repetitionCount: integer("repetition_count").notNull().default(0),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.cardId, table.userId] }),
    index("review_states_due_date_idx").on(table.dueDate),
    index("review_states_user_id_idx").on(table.userId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  decks: many(decks),
  reviewStates: many(reviewStates),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(users, {
    fields: [decks.userId],
    references: [users.id],
  }),
  parent: one(decks, {
    fields: [decks.parentId],
    references: [decks.id],
    relationName: "deck_parent",
  }),
  children: many(decks, { relationName: "deck_parent" }),
  cards: many(cards),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  deck: one(decks, {
    fields: [notes.deckId],
    references: [decks.id],
  }),
  pages: many(notePages),
}));

export const notePagesRelations = relations(notePages, ({ one }) => ({
  note: one(notes, {
    fields: [notePages.noteId],
    references: [notes.id],
  }),
}));

export const noteModelsRelations = relations(noteModels, ({ one, many }) => ({
  user: one(users, { fields: [noteModels.userId], references: [users.id] }),
  fields: many(modelFields),
  templates: many(cardTemplates),
  collectionNotes: many(collectionNotes),
}));

export const modelFieldsRelations = relations(modelFields, ({ one }) => ({
  model: one(noteModels, { fields: [modelFields.modelId], references: [noteModels.id] }),
}));

export const cardTemplatesRelations = relations(cardTemplates, ({ one }) => ({
  model: one(noteModels, { fields: [cardTemplates.modelId], references: [noteModels.id] }),
  deckOverride: one(decks, {
    fields: [cardTemplates.deckOverrideId],
    references: [decks.id],
  }),
}));

export const collectionNotesRelations = relations(collectionNotes, ({ one, many }) => ({
  user: one(users, { fields: [collectionNotes.userId], references: [users.id] }),
  model: one(noteModels, { fields: [collectionNotes.modelId], references: [noteModels.id] }),
  deck: one(decks, { fields: [collectionNotes.deckId], references: [decks.id] }),
  cards: many(cards),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  user: one(users, { fields: [mediaAssets.userId], references: [users.id] }),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  deck: one(decks, {
    fields: [cards.deckId],
    references: [decks.id],
  }),
  collectionNote: one(collectionNotes, {
    fields: [cards.collectionNoteId],
    references: [collectionNotes.id],
  }),
  sourceNote: one(notes, {
    fields: [cards.sourceNoteId],
    references: [notes.id],
  }),
  sourcePage: one(notePages, {
    fields: [cards.sourcePageId],
    references: [notePages.id],
  }),
  reviewStates: many(reviewStates),
  cardTags: many(cardTags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  cardTags: many(cardTags),
}));

export const cardTagsRelations = relations(cardTags, ({ one }) => ({
  card: one(cards, {
    fields: [cardTags.cardId],
    references: [cards.id],
  }),
  tag: one(tags, {
    fields: [cardTags.tagId],
    references: [tags.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}));

export const reviewStatesRelations = relations(reviewStates, ({ one }) => ({
  card: one(cards, {
    fields: [reviewStates.cardId],
    references: [cards.id],
  }),
  user: one(users, {
    fields: [reviewStates.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Deck = typeof decks.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type NotePage = typeof notePages.$inferSelect;
export type ReviewState = typeof reviewStates.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type CardTag = typeof cardTags.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type NoteModel = typeof noteModels.$inferSelect;
export type ModelField = typeof modelFields.$inferSelect;
export type CardTemplate = typeof cardTemplates.$inferSelect;
export type CollectionNote = typeof collectionNotes.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
