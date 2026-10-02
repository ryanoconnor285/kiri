import { cardTags, cards, decks, reviewStates, savedSearches, tags } from "@kiri/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { GraphQLContext } from "../context.js";

async function ownedCardIds(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
): Promise<string[]> {
  if (cardIds.length === 0) return [];
  const rows = await context.db
    .select({ id: cards.id })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(decks.userId, userId), inArray(cards.id, cardIds.slice(0, 500))));
  return rows.map((r) => r.id);
}

export async function setCardsSuspendedForUser(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
  suspended: boolean,
): Promise<number> {
  const ids = await ownedCardIds(context, userId, cardIds);
  if (ids.length === 0) return 0;
  await context.db.update(cards).set({ suspended, updatedAt: new Date() }).where(inArray(cards.id, ids));
  return ids.length;
}

export async function setCardsFlagForUser(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
  flag: number,
): Promise<number> {
  if (flag < 0 || flag > 7) {
    throw new Error("Flag must be between 0 and 7");
  }
  const ids = await ownedCardIds(context, userId, cardIds);
  if (ids.length === 0) return 0;
  await context.db.update(cards).set({ flag, updatedAt: new Date() }).where(inArray(cards.id, ids));
  return ids.length;
}

async function getOrCreateTag(context: GraphQLContext, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name required");
  const [existing] = await context.db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, trimmed)))
    .limit(1);
  if (existing) return existing;
  const [created] = await context.db
    .insert(tags)
    .values({ userId, name: trimmed })
    .onConflictDoNothing({ target: [tags.userId, tags.name] })
    .returning();
  if (created) return created;
  const [again] = await context.db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, trimmed)))
    .limit(1);
  if (!again) throw new Error("Could not create tag");
  return again;
}

export async function addTagsToCardsForUser(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
  tagNames: string[],
): Promise<number> {
  const ids = await ownedCardIds(context, userId, cardIds);
  if (ids.length === 0 || tagNames.length === 0) return 0;
  let links = 0;
  for (const name of tagNames) {
    const tag = await getOrCreateTag(context, userId, name);
    for (const cardId of ids) {
      await context.db.insert(cardTags).values({ cardId, tagId: tag.id }).onConflictDoNothing();
      links++;
    }
  }
  return links;
}

export async function removeTagsFromCardsForUser(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
  tagNames: string[],
): Promise<number> {
  const ids = await ownedCardIds(context, userId, cardIds);
  if (ids.length === 0 || tagNames.length === 0) return 0;
  const tagRows = await context.db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)));
  if (tagRows.length === 0) return 0;
  const tagIds = tagRows.map((t) => t.id);
  const result = await context.db
    .delete(cardTags)
    .where(and(inArray(cardTags.cardId, ids), inArray(cardTags.tagId, tagIds)))
    .returning({ cardId: cardTags.cardId });
  return result.length;
}

export async function listTagsForUser(context: GraphQLContext, userId: string) {
  return context.db
    .select()
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(asc(tags.name));
}

export async function listSavedSearchesForUser(context: GraphQLContext, userId: string) {
  return context.db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(asc(savedSearches.name));
}

export async function createSavedSearchForUser(
  context: GraphQLContext,
  userId: string,
  name: string,
  query: string,
) {
  const [row] = await context.db
    .insert(savedSearches)
    .values({ userId, name: name.trim(), query: query.trim() })
    .returning();
  return row!;
}

export async function deleteSavedSearchForUser(
  context: GraphQLContext,
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await context.db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
    .returning({ id: savedSearches.id });
  return result.length > 0;
}

export async function resetReviewStatesForUser(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
): Promise<number> {
  const ids = await ownedCardIds(context, userId, cardIds);
  if (ids.length === 0) return 0;
  await context.db
    .update(reviewStates)
    .set({
      interval: 0,
      repetitionCount: 0,
      easeFactor: 2.5,
      dueDate: new Date(),
    })
    .where(and(eq(reviewStates.userId, userId), inArray(reviewStates.cardId, ids)));
  return ids.length;
}

export async function setCardsDueDateForUser(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
  dueDate: Date,
): Promise<number> {
  const ids = await ownedCardIds(context, userId, cardIds);
  if (ids.length === 0) return 0;
  await context.db
    .update(reviewStates)
    .set({ dueDate })
    .where(and(eq(reviewStates.userId, userId), inArray(reviewStates.cardId, ids)));
  return ids.length;
}
