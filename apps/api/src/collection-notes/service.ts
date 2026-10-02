import type { CardTemplateDef } from "@kiri/card-templates";
import {
  cardTemplates,
  cards,
  collectionNotes,
  decks,
  modelFields,
  noteModels,
} from "@kiri/db";
import { and, asc, eq } from "drizzle-orm";
import type { GraphQLContext } from "../context.js";
import { regenerateCardsForCollectionNote } from "./regenerate.js";
import { ensureBuiltinNoteModels } from "./seed-models.js";

export async function listNoteModels(context: GraphQLContext, userId: string) {
  await ensureBuiltinNoteModels(context.db, userId);
  return context.db
    .select()
    .from(noteModels)
    .where(eq(noteModels.userId, userId))
    .orderBy(asc(noteModels.name));
}

export async function getNoteModel(context: GraphQLContext, userId: string, id: string) {
  const [model] = await context.db
    .select()
    .from(noteModels)
    .where(and(eq(noteModels.id, id), eq(noteModels.userId, userId)))
    .limit(1);
  return model ?? null;
}

export async function createNoteModel(
  context: GraphQLContext,
  userId: string,
  input: {
    name: string;
    kind?: string;
    css?: string;
    fields: Array<{ name: string; ord: number; isSort?: boolean }>;
    templates: CardTemplateDef[];
  },
) {
  const [model] = await context.db
    .insert(noteModels)
    .values({
      userId,
      name: input.name,
      kind: input.kind ?? "basic",
      css: input.css ?? "",
    })
    .returning();
  if (!model) throw new Error("Could not create note type");

  for (const field of input.fields) {
    await context.db.insert(modelFields).values({
      modelId: model.id,
      name: field.name,
      ord: field.ord,
      isSort: field.isSort ?? false,
    });
  }
  for (const tmpl of input.templates) {
    await context.db.insert(cardTemplates).values({
      modelId: model.id,
      ord: tmpl.ord,
      name: tmpl.name,
      qfmt: tmpl.qfmt,
      afmt: tmpl.afmt,
      deckOverrideId: tmpl.deckOverrideId ?? null,
    });
  }
  return model;
}

export async function cloneNoteModel(context: GraphQLContext, userId: string, sourceId: string) {
  const source = await getNoteModel(context, userId, sourceId);
  if (!source) throw new Error("Note type not found");

  const fields = await context.db
    .select()
    .from(modelFields)
    .where(eq(modelFields.modelId, sourceId))
    .orderBy(asc(modelFields.ord));
  const templates = await context.db
    .select()
    .from(cardTemplates)
    .where(eq(cardTemplates.modelId, sourceId))
    .orderBy(asc(cardTemplates.ord));

  return createNoteModel(context, userId, {
    name: `${source.name} copy`,
    kind: source.kind,
    css: source.css,
    fields: fields.map((f) => ({ name: f.name, ord: f.ord, isSort: f.isSort })),
    templates: templates.map((t) => ({
      ord: t.ord,
      name: t.name,
      qfmt: t.qfmt,
      afmt: t.afmt,
      deckOverrideId: t.deckOverrideId,
    })),
  });
}

export async function updateNoteModel(
  context: GraphQLContext,
  userId: string,
  id: string,
  patch: {
    name?: string;
    css?: string;
    fields?: Array<{ name: string; ord: number; isSort?: boolean }>;
    templates?: CardTemplateDef[];
  },
) {
  const model = await getNoteModel(context, userId, id);
  if (!model) throw new Error("Note type not found");

  await context.db
    .update(noteModels)
    .set({
      name: patch.name ?? model.name,
      css: patch.css ?? model.css,
      updatedAt: new Date(),
    })
    .where(eq(noteModels.id, id));

  if (patch.fields) {
    await context.db.delete(modelFields).where(eq(modelFields.modelId, id));
    for (const field of patch.fields) {
      await context.db.insert(modelFields).values({
        modelId: id,
        name: field.name,
        ord: field.ord,
        isSort: field.isSort ?? false,
      });
    }
  }

  if (patch.templates) {
    await context.db.delete(cardTemplates).where(eq(cardTemplates.modelId, id));
    for (const tmpl of patch.templates) {
      await context.db.insert(cardTemplates).values({
        modelId: id,
        ord: tmpl.ord,
        name: tmpl.name,
        qfmt: tmpl.qfmt,
        afmt: tmpl.afmt,
        deckOverrideId: tmpl.deckOverrideId ?? null,
      });
    }
  }

  const notes = await context.db
    .select({ id: collectionNotes.id })
    .from(collectionNotes)
    .where(eq(collectionNotes.modelId, id));
  for (const note of notes) {
    await regenerateCardsForCollectionNote(context, userId, note.id);
  }

  return getNoteModel(context, userId, id);
}

export async function listCollectionNotes(
  context: GraphQLContext,
  userId: string,
  deckId: string,
) {
  const [deck] = await context.db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  if (!deck) throw new Error("Folder not found");

  return context.db
    .select()
    .from(collectionNotes)
    .where(and(eq(collectionNotes.deckId, deckId), eq(collectionNotes.userId, userId)))
    .orderBy(asc(collectionNotes.updatedAt));
}

export async function getCollectionNote(context: GraphQLContext, userId: string, id: string) {
  const [note] = await context.db
    .select()
    .from(collectionNotes)
    .where(and(eq(collectionNotes.id, id), eq(collectionNotes.userId, userId)))
    .limit(1);
  return note ?? null;
}

export async function upsertCollectionNote(
  context: GraphQLContext,
  userId: string,
  input: {
    id?: string | null;
    modelId: string;
    deckId: string;
    fieldValues: Record<string, string>;
  },
) {
  const model = await getNoteModel(context, userId, input.modelId);
  if (!model) throw new Error("Note type not found");
  const [deck] = await context.db
    .select()
    .from(decks)
    .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)))
    .limit(1);
  if (!deck) throw new Error("Folder not found");

  let noteId = input.id;
  if (noteId) {
    await context.db
      .update(collectionNotes)
      .set({
        modelId: input.modelId,
        deckId: input.deckId,
        fieldValues: input.fieldValues,
        updatedAt: new Date(),
      })
      .where(and(eq(collectionNotes.id, noteId), eq(collectionNotes.userId, userId)));
  } else {
    const [created] = await context.db
      .insert(collectionNotes)
      .values({
        userId,
        modelId: input.modelId,
        deckId: input.deckId,
        fieldValues: input.fieldValues,
      })
      .returning();
    noteId = created?.id;
  }
  if (!noteId) throw new Error("Could not save note");

  await regenerateCardsForCollectionNote(context, userId, noteId);
  return getCollectionNote(context, userId, noteId);
}

export async function changeCollectionNoteModel(
  context: GraphQLContext,
  userId: string,
  noteId: string,
  targetModelId: string,
  fieldMap: Record<string, string>,
) {
  const note = await getCollectionNote(context, userId, noteId);
  if (!note) throw new Error("Note not found");
  const target = await getNoteModel(context, userId, targetModelId);
  if (!target) throw new Error("Target note type not found");

  const nextValues: Record<string, string> = {};
  for (const [oldName, value] of Object.entries(note.fieldValues ?? {})) {
    const newName = fieldMap[oldName] ?? oldName;
    nextValues[newName] = value;
  }

  await context.db
    .update(collectionNotes)
    .set({
      modelId: targetModelId,
      fieldValues: nextValues,
      updatedAt: new Date(),
    })
    .where(eq(collectionNotes.id, noteId));

  await regenerateCardsForCollectionNote(context, userId, noteId);
  return getCollectionNote(context, userId, noteId);
}

export async function deleteCollectionNote(context: GraphQLContext, userId: string, id: string) {
  const result = await context.db
    .delete(collectionNotes)
    .where(and(eq(collectionNotes.id, id), eq(collectionNotes.userId, userId)))
    .returning({ id: collectionNotes.id });
  return result.length > 0;
}

export async function listCardsForCollectionNote(
  context: GraphQLContext,
  collectionNoteId: string,
) {
  return context.db
    .select()
    .from(cards)
    .where(eq(cards.collectionNoteId, collectionNoteId))
    .orderBy(asc(cards.templateOrd), asc(cards.clozeOrd));
}
