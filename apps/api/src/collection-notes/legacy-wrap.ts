import { cards, collectionNotes, decks } from "@kiri/db";
import { and, eq, isNull } from "drizzle-orm";
import type { GraphQLContext } from "../context.js";
import { getOrCreateLegacyWrapModel } from "./seed-models.js";
import { regenerateCardsForCollectionNote } from "./regenerate.js";

/** Wrap flat cards (no collection_note_id) into Basic collection notes. */
export async function wrapLegacyFlatCards(context: GraphQLContext, userId: string) {
  const legacyModel = await getOrCreateLegacyWrapModel(context.db, userId);

  const orphanRows = await context.db
    .select({ card: cards })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(decks.userId, userId), isNull(cards.collectionNoteId)));

  let wrapped = 0;
  for (const row of orphanRows) {
    const [cn] = await context.db
      .insert(collectionNotes)
      .values({
        userId,
        modelId: legacyModel.id,
        deckId: row.card.deckId,
        fieldValues: {
          Front: row.card.frontText,
          Back: row.card.backText,
        },
      })
      .returning();
    if (!cn) continue;

    await context.db
      .update(cards)
      .set({
        collectionNoteId: cn.id,
        templateOrd: 0,
        clozeOrd: -1,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, row.card.id));

    await regenerateCardsForCollectionNote(context, userId, cn.id);
    wrapped += 1;
  }

  return wrapped;
}
