import {
  cardGenerationKey,
  generateCardsFromNote,
  type CardTemplateDef,
  type NoteModelKind,
} from "@kiri/card-templates";
import {
  cardTemplates,
  cards,
  collectionNotes,
  decks,
  modelFields,
  noteModels,
  reviewStates,
} from "@kiri/db";
import { and, eq, inArray } from "drizzle-orm";
import type { GraphQLContext } from "../context.js";

export async function loadModelBundle(
  context: GraphQLContext,
  userId: string,
  modelId: string,
) {
  const [model] = await context.db
    .select()
    .from(noteModels)
    .where(and(eq(noteModels.id, modelId), eq(noteModels.userId, userId)))
    .limit(1);
  if (!model) return null;

  const fields = await context.db
    .select()
    .from(modelFields)
    .where(eq(modelFields.modelId, modelId))
    .orderBy(modelFields.ord);
  const templates = await context.db
    .select()
    .from(cardTemplates)
    .where(eq(cardTemplates.modelId, modelId))
    .orderBy(cardTemplates.ord);

  return { model, fields, templates };
}

export async function regenerateCardsForCollectionNote(
  context: GraphQLContext,
  userId: string,
  collectionNoteId: string,
): Promise<string[]> {
  const [note] = await context.db
    .select({
      note: collectionNotes,
      deck: decks,
      model: noteModels,
    })
    .from(collectionNotes)
    .innerJoin(decks, eq(collectionNotes.deckId, decks.id))
    .innerJoin(noteModels, eq(collectionNotes.modelId, noteModels.id))
    .where(and(eq(collectionNotes.id, collectionNoteId), eq(collectionNotes.userId, userId)))
    .limit(1);

  if (!note) {
    throw new Error("Collection note not found");
  }

  const templates = await context.db
    .select()
    .from(cardTemplates)
    .where(eq(cardTemplates.modelId, note.model.id))
    .orderBy(cardTemplates.ord);

  const templateDefs: CardTemplateDef[] = templates.map((t) => ({
    ord: t.ord,
    name: t.name,
    qfmt: t.qfmt,
    afmt: t.afmt,
    deckOverrideId: t.deckOverrideId,
  }));

  const specs = generateCardsFromNote(
    note.model.kind as NoteModelKind,
    templateDefs,
    note.note.fieldValues ?? {},
    {
      deckName: note.deck.title,
      noteTypeName: note.model.name,
    },
  );

  const existing = await context.db
    .select()
    .from(cards)
    .where(eq(cards.collectionNoteId, collectionNoteId));

  const existingByKey = new Map(
    existing.map((c) => [cardGenerationKey(c.templateOrd, c.clozeOrd), c]),
  );
  const desiredKeys = new Set<string>();
  const keptIds: string[] = [];

  for (const spec of specs) {
    const key = cardGenerationKey(spec.templateOrd, spec.clozeOrd);
    desiredKeys.add(key);
    const targetDeckId =
      templateDefs.find((t) => t.ord === spec.templateOrd)?.deckOverrideId ?? note.note.deckId;

    const prev = existingByKey.get(key);
    if (prev) {
      await context.db
        .update(cards)
        .set({
          deckId: targetDeckId,
          frontText: spec.front,
          backText: spec.back,
          templateOrd: spec.templateOrd,
          clozeOrd: spec.clozeOrd,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, prev.id));
      keptIds.push(prev.id);
    } else {
      const [inserted] = await context.db
        .insert(cards)
        .values({
          deckId: targetDeckId,
          collectionNoteId,
          templateOrd: spec.templateOrd,
          clozeOrd: spec.clozeOrd,
          frontText: spec.front,
          backText: spec.back,
        })
        .returning({ id: cards.id });
      if (inserted) {
        await context.db.insert(reviewStates).values({
          cardId: inserted.id,
          userId,
        });
        keptIds.push(inserted.id);
      }
    }
  }

  const toDelete = existing.filter(
    (c) => !desiredKeys.has(cardGenerationKey(c.templateOrd, c.clozeOrd)),
  );
  if (toDelete.length > 0) {
    await context.db.delete(cards).where(
      inArray(
        cards.id,
        toDelete.map((c) => c.id),
      ),
    );
  }

  await context.db
    .update(collectionNotes)
    .set({ updatedAt: new Date() })
    .where(eq(collectionNotes.id, collectionNoteId));

  return keptIds;
}
