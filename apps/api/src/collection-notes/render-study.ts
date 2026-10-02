import { cardTemplates, cards, collectionNotes, decks, noteModels } from "@kiri/db";
import { extractTypeInField, parseMultipleChoiceFields } from "@kiri/card-templates";
import { and, eq } from "drizzle-orm";
import type { GraphQLContext } from "../context.js";

export type CardStudyRender = {
  cardId: string;
  studyMode: "STANDARD" | "MULTIPLE_CHOICE" | "TYPE_IN";
  frontHtml: string;
  backHtml: string;
  modelCss: string;
  typeInField: string | null;
  noteTypeName: string | null;
  mcChoices: string[] | null;
  mcAllowMultiple: boolean | null;
  mcCorrectIndices: number[] | null;
};

export async function getCardStudyRender(
  context: GraphQLContext,
  userId: string,
  cardId: string,
  revealed = false,
): Promise<CardStudyRender | null> {
  const [row] = await context.db
    .select({
      card: cards,
      deck: decks,
      note: collectionNotes,
      model: noteModels,
    })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .leftJoin(collectionNotes, eq(cards.collectionNoteId, collectionNotes.id))
    .leftJoin(noteModels, eq(collectionNotes.modelId, noteModels.id))
    .where(and(eq(cards.id, cardId), eq(decks.userId, userId)))
    .limit(1);

  if (!row) return null;

  let typeInField: string | null = null;
  let studyMode: CardStudyRender["studyMode"] = "STANDARD";
  let mcChoices: string[] | null = null;
  let mcAllowMultiple: boolean | null = null;
  let mcCorrectIndices: number[] | null = null;

  if (row.model?.kind === "multiple_choice" && row.note?.fieldValues) {
    const mc = parseMultipleChoiceFields(row.note.fieldValues);
    if (mc) {
      studyMode = "MULTIPLE_CHOICE";
      mcChoices = mc.choices;
      mcAllowMultiple = mc.allowMultiple;
      if (revealed) {
        mcCorrectIndices = mc.correctIndices;
      }
    }
  } else if (row.card.collectionNoteId) {
    const [tmpl] = await context.db
      .select({ qfmt: cardTemplates.qfmt })
      .from(cardTemplates)
      .where(
        and(
          eq(cardTemplates.modelId, row.note?.modelId ?? ""),
          eq(cardTemplates.ord, row.card.templateOrd),
        ),
      )
      .limit(1);
    if (tmpl) {
      typeInField = extractTypeInField(tmpl.qfmt);
      if (typeInField) studyMode = "TYPE_IN";
    }
  }

  return {
    cardId: row.card.id,
    studyMode,
    frontHtml: row.card.frontText,
    backHtml: row.card.backText,
    modelCss: row.model?.css ?? "",
    typeInField,
    noteTypeName: row.model?.name ?? null,
    mcChoices,
    mcAllowMultiple,
    mcCorrectIndices,
  };
}
