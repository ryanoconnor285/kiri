import SchemaBuilder from "@pothos/core";
import DataloaderPlugin from "@pothos/plugin-dataloader";
import { cards, decks, reviewStates } from "@kiri/db";
import { AiImportInputSchema, stubAiImport } from "@kiri/schema";
import { and, count, eq, lte, sql } from "drizzle-orm";
import type { GraphQLContext } from "../context.js";
import { calculateSm2 } from "../srs/sm2.js";

const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
  };
}>({
  plugins: [DataloaderPlugin],
});

builder.scalarType("DateTime", {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => new Date(String(value)),
});

function requireUser(context: GraphQLContext) {
  if (!context.user) {
    throw new Error("Unauthorized");
  }
  return context.user;
}

async function getOwnedDeck(context: GraphQLContext, userId: string, deckId: string) {
  const [deck] = await context.db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  return deck ?? null;
}

// Walk up from candidateParentId; if we reach deckId, reparenting would form a cycle.
async function wouldCreateCycle(
  context: GraphQLContext,
  deckId: string,
  candidateParentId: string,
): Promise<boolean> {
  let current: string | null = candidateParentId;
  while (current) {
    if (current === deckId) {
      return true;
    }
    const [row] = await context.db
      .select({ parentId: decks.parentId })
      .from(decks)
      .where(eq(decks.id, current))
      .limit(1);
    current = row?.parentId ?? null;
  }
  return false;
}

const UserType = builder.objectRef<{
  id: string;
  email: string;
  name: string | null;
}>("User");

UserType.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    email: t.exposeString("email"),
    name: t.exposeString("name", { nullable: true }),
  }),
});

const DeckType = builder.objectRef<{
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  createdAt: Date;
  cardCount?: number;
}>("Deck");

DeckType.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    parentId: t.exposeString("parentId", { nullable: true }),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    cardCount: t.int({
      nullable: true,
      resolve: async (deck, _args, context) => {
        const [result] = await context.db
          .select({ value: count() })
          .from(cards)
          .where(eq(cards.deckId, deck.id));
        return result?.value ?? 0;
      },
    }),
    children: t.field({
      type: [DeckType],
      resolve: async (deck, _args, context) => {
        return context.db
          .select()
          .from(decks)
          .where(and(eq(decks.parentId, deck.id), eq(decks.userId, deck.userId)))
          .orderBy(decks.createdAt);
      },
    }),
  }),
});

const CardType = builder.objectRef<{
  id: string;
  deckId: string;
  frontText: string;
  backText: string;
  frontPencilData: Buffer | null;
  backPencilData: Buffer | null;
  createdAt: Date;
  updatedAt: Date;
}>("Card");

CardType.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    deckId: t.exposeString("deckId"),
    frontText: t.exposeString("frontText"),
    backText: t.exposeString("backText"),
    frontPencilData: t.string({
      nullable: true,
      resolve: (card) =>
        card.frontPencilData ? card.frontPencilData.toString("base64") : null,
    }),
    backPencilData: t.string({
      nullable: true,
      resolve: (card) =>
        card.backPencilData ? card.backPencilData.toString("base64") : null,
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

const ReviewStateType = builder.objectRef<{
  cardId: string;
  userId: string;
  interval: number;
  repetitionCount: number;
  easeFactor: number;
  dueDate: Date;
}>("ReviewState");

ReviewStateType.implement({
  fields: (t) => ({
    cardId: t.exposeString("cardId"),
    interval: t.exposeInt("interval"),
    repetitionCount: t.exposeInt("repetitionCount"),
    easeFactor: t.exposeFloat("easeFactor"),
    dueDate: t.expose("dueDate", { type: "DateTime" }),
    card: t.field({
      type: CardType,
      resolve: async (state, _args, context) => {
        const [card] = await context.db
          .select()
          .from(cards)
          .where(eq(cards.id, state.cardId))
          .limit(1);
        if (!card) {
          throw new Error("Card not found");
        }
        return card;
      },
    }),
  }),
});

const CardPayloadType = builder.objectRef<{
  frontText: string;
  backText: string;
  frontPencilData?: string | null;
  backPencilData?: string | null;
}>("CardPayload");

CardPayloadType.implement({
  fields: (t) => ({
    frontText: t.exposeString("frontText"),
    backText: t.exposeString("backText"),
    frontPencilData: t.exposeString("frontPencilData", { nullable: true }),
    backPencilData: t.exposeString("backPencilData", { nullable: true }),
  }),
});

const AiImportResultType = builder.objectRef<{
  cards: Array<{
    frontText: string;
    backText: string;
    frontPencilData?: string | null;
    backPencilData?: string | null;
  }>;
  normalizedCount: number;
}>("AiImportResult");

AiImportResultType.implement({
  fields: (t) => ({
    normalizedCount: t.exposeInt("normalizedCount"),
    cards: t.field({
      type: [CardPayloadType],
      resolve: (parent) => parent.cards,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: UserType,
      nullable: true,
      resolve: (_root, _args, context) => {
        if (!context.user) {
          return null;
        }
        return {
          id: context.user.userId,
          email: context.user.email,
          name: context.user.name,
        };
      },
    }),
    decks: t.field({
      type: [DeckType],
      resolve: async (_root, _args, context) => {
        const user = requireUser(context);
        return context.db
          .select()
          .from(decks)
          .where(eq(decks.userId, user.userId))
          .orderBy(decks.createdAt);
      },
    }),
    deck: t.field({
      type: DeckType,
      nullable: true,
      args: {
        id: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        const [deck] = await context.db
          .select()
          .from(decks)
          .where(and(eq(decks.id, args.id), eq(decks.userId, user.userId)))
          .limit(1);
        return deck ?? null;
      },
    }),
    cards: t.field({
      type: [CardType],
      args: {
        deckId: t.arg.string({ required: true }),
        limit: t.arg.int({ required: false, defaultValue: 50 }),
        offset: t.arg.int({ required: false, defaultValue: 0 }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        const [deck] = await context.db
          .select()
          .from(decks)
          .where(and(eq(decks.id, args.deckId), eq(decks.userId, user.userId)))
          .limit(1);
        if (!deck) {
          throw new Error("Deck not found");
        }
        return context.db
          .select()
          .from(cards)
          .where(eq(cards.deckId, args.deckId))
          .orderBy(cards.createdAt)
          .limit(args.limit ?? 50)
          .offset(args.offset ?? 0);
      },
    }),
    dueCards: t.field({
      type: [ReviewStateType],
      args: {
        deckId: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        const [deck] = await context.db
          .select()
          .from(decks)
          .where(and(eq(decks.id, args.deckId), eq(decks.userId, user.userId)))
          .limit(1);
        if (!deck) {
          throw new Error("Deck not found");
        }
        return context.db
          .select({
            cardId: reviewStates.cardId,
            userId: reviewStates.userId,
            interval: reviewStates.interval,
            repetitionCount: reviewStates.repetitionCount,
            easeFactor: reviewStates.easeFactor,
            dueDate: reviewStates.dueDate,
          })
          .from(reviewStates)
          .innerJoin(cards, eq(reviewStates.cardId, cards.id))
          .where(
            and(
              eq(reviewStates.userId, user.userId),
              eq(cards.deckId, args.deckId),
              lte(reviewStates.dueDate, sql`now()`),
            ),
          )
          .orderBy(reviewStates.dueDate);
      },
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createDeck: t.field({
      type: DeckType,
      args: {
        title: t.arg.string({ required: true }),
        description: t.arg.string({ required: false }),
        parentId: t.arg.string({ required: false }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        if (args.parentId) {
          const parent = await getOwnedDeck(context, user.userId, args.parentId);
          if (!parent) {
            throw new Error("Parent deck not found");
          }
        }
        const [deck] = await context.db
          .insert(decks)
          .values({
            userId: user.userId,
            title: args.title,
            description: args.description ?? null,
            parentId: args.parentId ?? null,
          })
          .returning();
        return deck!;
      },
    }),
    updateDeck: t.field({
      type: DeckType,
      args: {
        id: t.arg.string({ required: true }),
        title: t.arg.string({ required: false }),
        description: t.arg.string({ required: false }),
        // Omit to leave the parent unchanged; pass null to move to the top level.
        parentId: t.arg.string({ required: false }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        const existing = await getOwnedDeck(context, user.userId, args.id);
        if (!existing) {
          throw new Error("Deck not found");
        }

        let nextParentId = existing.parentId;
        if (args.parentId !== undefined) {
          if (args.parentId === null) {
            nextParentId = null;
          } else {
            if (args.parentId === args.id) {
              throw new Error("A deck cannot be its own parent");
            }
            const parent = await getOwnedDeck(context, user.userId, args.parentId);
            if (!parent) {
              throw new Error("Parent deck not found");
            }
            if (await wouldCreateCycle(context, args.id, args.parentId)) {
              throw new Error("Cannot move a deck into one of its descendants");
            }
            nextParentId = args.parentId;
          }
        }

        const [deck] = await context.db
          .update(decks)
          .set({
            title: args.title ?? existing.title,
            description:
              args.description !== undefined && args.description !== null
                ? args.description
                : existing.description,
            parentId: nextParentId,
          })
          .where(eq(decks.id, args.id))
          .returning();
        return deck!;
      },
    }),
    deleteDeck: t.field({
      type: "Boolean",
      args: {
        id: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        const result = await context.db
          .delete(decks)
          .where(and(eq(decks.id, args.id), eq(decks.userId, user.userId)))
          .returning({ id: decks.id });
        return result.length > 0;
      },
    }),
    upsertCard: t.field({
      type: CardType,
      args: {
        id: t.arg.string({ required: false }),
        deckId: t.arg.string({ required: true }),
        frontText: t.arg.string({ required: true }),
        backText: t.arg.string({ required: true }),
        frontPencilData: t.arg.string({ required: false }),
        backPencilData: t.arg.string({ required: false }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        const [deck] = await context.db
          .select()
          .from(decks)
          .where(and(eq(decks.id, args.deckId), eq(decks.userId, user.userId)))
          .limit(1);
        if (!deck) {
          throw new Error("Deck not found");
        }

        const frontPencil = args.frontPencilData
          ? Buffer.from(args.frontPencilData, "base64")
          : null;
        const backPencil = args.backPencilData
          ? Buffer.from(args.backPencilData, "base64")
          : null;

        if (args.id) {
          const [existing] = await context.db
            .select()
            .from(cards)
            .where(and(eq(cards.id, args.id), eq(cards.deckId, args.deckId)))
            .limit(1);
          if (!existing) {
            throw new Error("Card not found");
          }
          const [card] = await context.db
            .update(cards)
            .set({
              frontText: args.frontText,
              backText: args.backText,
              frontPencilData: frontPencil ?? existing.frontPencilData,
              backPencilData: backPencil ?? existing.backPencilData,
              updatedAt: new Date(),
            })
            .where(eq(cards.id, args.id))
            .returning();
          return card!;
        }

        const [card] = await context.db
          .insert(cards)
          .values({
            deckId: args.deckId,
            frontText: args.frontText,
            backText: args.backText,
            frontPencilData: frontPencil,
            backPencilData: backPencil,
          })
          .returning();

        await context.db.insert(reviewStates).values({
          cardId: card!.id,
          userId: user.userId,
        });

        return card!;
      },
    }),
    deleteCard: t.field({
      type: "Boolean",
      args: {
        id: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        const [card] = await context.db
          .select({ card: cards, deck: decks })
          .from(cards)
          .innerJoin(decks, eq(cards.deckId, decks.id))
          .where(and(eq(cards.id, args.id), eq(decks.userId, user.userId)))
          .limit(1);
        if (!card) {
          return false;
        }
        await context.db.delete(cards).where(eq(cards.id, args.id));
        return true;
      },
    }),
    submitReview: t.field({
      type: ReviewStateType,
      args: {
        cardId: t.arg.string({ required: true }),
        quality: t.arg.int({ required: true }),
      },
      resolve: async (_root, args, context) => {
        const user = requireUser(context);
        if (args.quality < 0 || args.quality > 5) {
          throw new Error("Quality must be between 0 and 5");
        }

        const [existing] = await context.db
          .select()
          .from(reviewStates)
          .where(
            and(
              eq(reviewStates.cardId, args.cardId),
              eq(reviewStates.userId, user.userId),
            ),
          )
          .limit(1);

        const previous = existing ?? {
          interval: 0,
          repetitionCount: 0,
          easeFactor: 2.5,
        };

        const result = calculateSm2(args.quality as 0 | 1 | 2 | 3 | 4 | 5, previous);

        if (existing) {
          const [updated] = await context.db
            .update(reviewStates)
            .set({
              interval: result.interval,
              repetitionCount: result.repetitionCount,
              easeFactor: result.easeFactor,
              dueDate: result.dueDate,
            })
            .where(
              and(
                eq(reviewStates.cardId, args.cardId),
                eq(reviewStates.userId, user.userId),
              ),
            )
            .returning();
          return updated!;
        }

        const [created] = await context.db
          .insert(reviewStates)
          .values({
            cardId: args.cardId,
            userId: user.userId,
            interval: result.interval,
            repetitionCount: result.repetitionCount,
            easeFactor: result.easeFactor,
            dueDate: result.dueDate,
          })
          .returning();
        return created!;
      },
    }),
    aiImportCards: t.field({
      type: AiImportResultType,
      args: {
        rawText: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, context) => {
        requireUser(context);
        const parsed = AiImportInputSchema.safeParse({ raw_text: args.rawText });
        if (!parsed.success) {
          throw new Error("Invalid import input");
        }

        const imported = stubAiImport(parsed.data.raw_text);
        return {
          cards: imported.map((card) => ({
            frontText: card.front_text,
            backText: card.back_text,
            frontPencilData: card.front_pencil_data ?? null,
            backPencilData: card.back_pencil_data ?? null,
          })),
          normalizedCount: imported.length,
        };
      },
    }),
  }),
});

export const schema = builder.toSchema();
