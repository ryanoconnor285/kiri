import {
  mcImportToFieldValues,
  parseMultipleChoiceImport,
  stubAiImport,
} from "@kiri/schema";
import { cards, decks, noteModels, reviewStates } from "@kiri/db";
import { and, eq } from "drizzle-orm";
import type { GraphQLContext } from "../context.js";
import { ensureBuiltinNoteModels } from "./seed-models.js";
import { upsertCollectionNote } from "./service.js";

export async function importPastedText(
  context: GraphQLContext,
  userId: string,
  deckId: string,
  rawText: string,
): Promise<{ importedCount: number; format: "multiple_choice" | "qa" }> {
  const [deck] = await context.db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  if (!deck) {
    throw new Error("Deck not found");
  }

  const mcNotes = parseMultipleChoiceImport(rawText);
  if (mcNotes.length > 0) {
    await ensureBuiltinNoteModels(context.db, userId);
    const [model] = await context.db
      .select({ id: noteModels.id })
      .from(noteModels)
      .where(
        and(eq(noteModels.userId, userId), eq(noteModels.builtinSlug, "multiple-choice")),
      )
      .limit(1);
    if (!model) {
      throw new Error("Multiple choice note type is not available");
    }

    for (const note of mcNotes) {
      await upsertCollectionNote(context, userId, {
        modelId: model.id,
        deckId,
        fieldValues: mcImportToFieldValues(note),
      });
    }
    return { importedCount: mcNotes.length, format: "multiple_choice" };
  }

  const qa = stubAiImport(rawText);
  if (qa.length === 0) {
    throw new Error(
      "No cards found. Use blank lines between Q/A pairs, Front | Back, or Multiple choice blocks (Question / Choices / Correct).",
    );
  }

  for (const card of qa) {
    const [inserted] = await context.db
      .insert(cards)
      .values({
        deckId,
        frontText: card.front_text,
        backText: card.back_text,
      })
      .returning({ id: cards.id });
    if (inserted) {
      await context.db.insert(reviewStates).values({
        cardId: inserted.id,
        userId,
      });
    }
  }

  return { importedCount: qa.length, format: "qa" };
}
