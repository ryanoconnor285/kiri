import {
  cardTags,
  cards,
  decks,
  reviewStates,
  tags,
  type Database,
} from "@kiri/db";
import { normalizeCardTextForDuplicate, parseCardSearchQuery } from "@kiri/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lte,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { GraphQLContext } from "../context.js";

export type BrowseCardRow = {
  id: string;
  deckId: string;
  folderTitle: string;
  folderPath: string;
  frontText: string;
  backText: string;
  createdAt: Date;
  updatedAt: Date;
  suspended: boolean;
  flag: number;
  tags: string[];
  interval: number;
  repetitionCount: number;
  easeFactor: number;
  dueDate: Date;
};

export type SearchCardsSortBy =
  | "FRONT"
  | "BACK"
  | "FOLDER"
  | "DUE"
  | "EASE"
  | "INTERVAL"
  | "CREATED"
  | "UPDATED";

export type SearchCardsOptions = {
  query?: string | null;
  folderId?: string | null;
  includeSubfolders?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: SearchCardsSortBy;
  sortDir?: "ASC" | "DESC";
};

type DeckLink = { id: string; parentId: string | null; title: string };

function collectDescendantIds(all: DeckLink[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const deck of all) {
    if (!deck.parentId) continue;
    const list = children.get(deck.parentId) ?? [];
    list.push(deck.id);
    children.set(deck.parentId, list);
  }
  const ids: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const child of children.get(id) ?? []) {
      stack.push(child);
    }
  }
  return ids;
}

function buildFolderPath(
  deckId: string,
  deckById: Map<string, { title: string; parentId: string | null }>,
): string {
  const parts: string[] = [];
  let current: string | null = deckId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const d = deckById.get(current);
    if (!d) break;
    parts.unshift(d.title);
    current = d.parentId;
  }
  return parts.join(" / ");
}

async function loadUserDecks(db: Database, userId: string): Promise<DeckLink[]> {
  return db
    .select({ id: decks.id, parentId: decks.parentId, title: decks.title })
    .from(decks)
    .where(eq(decks.userId, userId));
}

async function resolveScopeDeckIds(
  context: GraphQLContext,
  userId: string,
  folderId: string | null | undefined,
  includeSubfolders: boolean,
  parsedFolderIds: string[],
): Promise<string[] | null> {
  const all = await loadUserDecks(context.db, userId);
  const ownedIds = new Set(all.map((d) => d.id));

  let scope: Set<string> | null = null;

  if (folderId) {
    if (!ownedIds.has(folderId)) return null;
    const ids = includeSubfolders
      ? collectDescendantIds(all, folderId)
      : [folderId];
    scope = new Set(ids);
  }

  for (const id of parsedFolderIds) {
    if (!ownedIds.has(id)) continue;
    const ids = collectDescendantIds(all, id);
    const set = new Set(ids);
    scope = scope ? new Set([...scope].filter((x) => set.has(x))) : set;
  }

  if (scope && scope.size === 0) return [];
  if (!scope) return null;
  return [...scope];
}

async function deckIdsMatchingTitles(
  db: Database,
  userId: string,
  titles: string[],
): Promise<string[]> {
  if (titles.length === 0) return [];
  const all = await loadUserDecks(db, userId);
  const ids: string[] = [];
  for (const title of titles) {
    const needle = title.toLowerCase();
    for (const deck of all) {
      if (deck.title.toLowerCase().includes(needle)) {
        ids.push(deck.id);
      }
    }
  }
  return [...new Set(ids)];
}

async function buildSearchConditions(
  db: Database,
  userId: string,
  scopeDeckIds: string[] | null,
  query: string | null | undefined,
): Promise<SQL | undefined> {
  const parsed = parseCardSearchQuery(query ?? "");
  const conditions: SQL[] = [eq(decks.userId, userId)];

  if (scopeDeckIds) {
    if (scopeDeckIds.length === 0) {
      return sql`false`;
    }
    conditions.push(inArray(cards.deckId, scopeDeckIds));
  }

  const deckTitleIds = await deckIdsMatchingTitles(db, userId, parsed.deckTitles);
  if (parsed.deckTitles.length > 0) {
    if (deckTitleIds.length === 0) {
      return sql`false`;
    }
    conditions.push(inArray(cards.deckId, deckTitleIds));
  }

  if (parsed.excludeDeckTitles.length > 0) {
    const excludeIds = await deckIdsMatchingTitles(db, userId, parsed.excludeDeckTitles);
    if (excludeIds.length > 0) {
      conditions.push(not(inArray(cards.deckId, excludeIds)));
    }
  }

  for (const term of parsed.textTerms) {
    const pattern = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(ilike(cards.frontText, pattern), ilike(cards.backText, pattern))!);
  }

  for (const term of parsed.excludeTextTerms) {
    const pattern = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      not(or(ilike(cards.frontText, pattern), ilike(cards.backText, pattern))!),
    );
  }

  if (parsed.isDue === true) {
    conditions.push(lte(reviewStates.dueDate, sql`now()`));
    conditions.push(eq(cards.suspended, false));
  } else if (parsed.isDue === false) {
    conditions.push(or(sql`${reviewStates.dueDate} > now()`, eq(cards.suspended, true))!);
  }

  if (parsed.isNew === true) {
    conditions.push(eq(reviewStates.interval, 0));
  } else if (parsed.isNew === false) {
    conditions.push(sql`${reviewStates.interval} > 0`);
  }

  if (parsed.isSuspended === true) {
    conditions.push(eq(cards.suspended, true));
  } else if (parsed.isSuspended === false) {
    conditions.push(eq(cards.suspended, false));
  }

  if (parsed.flags.length > 0) {
    conditions.push(inArray(cards.flag, parsed.flags));
  }

  if (parsed.addedWithinDays !== undefined) {
    conditions.push(
      gte(cards.createdAt, sql`now() - (${parsed.addedWithinDays} || ' days')::interval`),
    );
  }

  if (parsed.editedWithinDays !== undefined) {
    conditions.push(
      gte(cards.updatedAt, sql`now() - (${parsed.editedWithinDays} || ' days')::interval`),
    );
  }

  if (parsed.tagNone) {
    conditions.push(
      not(
        exists(
          db.select({ cardId: cardTags.cardId }).from(cardTags).where(eq(cardTags.cardId, cards.id)),
        ),
      ),
    );
  }

  for (const tagName of parsed.tags) {
    conditions.push(
      exists(
        db
          .select({ cardId: cardTags.cardId })
          .from(cardTags)
          .innerJoin(tags, eq(cardTags.tagId, tags.id))
          .where(
            and(
              eq(cardTags.cardId, cards.id),
              eq(tags.userId, userId),
              sql`lower(${tags.name}) = lower(${tagName})`,
            ),
          ),
      ),
    );
  }

  for (const tagName of parsed.excludeTags) {
    conditions.push(
      not(
        exists(
          db
            .select({ cardId: cardTags.cardId })
            .from(cardTags)
            .innerJoin(tags, eq(cardTags.tagId, tags.id))
            .where(
              and(
                eq(cardTags.cardId, cards.id),
                eq(tags.userId, userId),
                sql`lower(${tags.name}) = lower(${tagName})`,
              ),
            ),
        ),
      ),
    );
  }

  return and(...conditions);
}

function sortColumn(sortBy: SearchCardsSortBy) {
  switch (sortBy) {
    case "BACK":
      return cards.backText;
    case "FOLDER":
      return decks.title;
    case "DUE":
      return reviewStates.dueDate;
    case "EASE":
      return reviewStates.easeFactor;
    case "INTERVAL":
      return reviewStates.interval;
    case "UPDATED":
      return cards.updatedAt;
    case "CREATED":
      return cards.createdAt;
    case "FRONT":
    default:
      return cards.frontText;
  }
}

async function loadTagsForCards(
  db: Database,
  userId: string,
  cardIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (cardIds.length === 0) return map;
  const rows = await db
    .select({ cardId: cardTags.cardId, name: tags.name })
    .from(cardTags)
    .innerJoin(tags, eq(cardTags.tagId, tags.id))
    .where(and(eq(tags.userId, userId), inArray(cardTags.cardId, cardIds)))
    .orderBy(asc(tags.name));
  for (const row of rows) {
    const list = map.get(row.cardId) ?? [];
    list.push(row.name);
    map.set(row.cardId, list);
  }
  return map;
}

export async function searchCardsForUser(
  context: GraphQLContext,
  userId: string,
  options: SearchCardsOptions,
): Promise<{ total: number; items: BrowseCardRow[] } | null> {
  const parsed = parseCardSearchQuery(options.query ?? "");
  const scopeDeckIds = await resolveScopeDeckIds(
    context,
    userId,
    options.folderId,
    options.includeSubfolders !== false,
    parsed.folderIds,
  );
  if (scopeDeckIds === null && options.folderId) {
    return null;
  }

  const where = await buildSearchConditions(
    context.db,
    userId,
    scopeDeckIds,
    options.query,
  );
  if (where === undefined) {
    return { total: 0, items: [] };
  }

  const baseFrom = context.db
    .select({ value: count() })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .innerJoin(
      reviewStates,
      and(eq(reviewStates.cardId, cards.id), eq(reviewStates.userId, userId)),
    )
    .where(where);

  const [totalRow] = await baseFrom;
  const total = totalRow?.value ?? 0;

  const sortBy = options.sortBy ?? "FRONT";
  const sortDir = options.sortDir ?? "ASC";
  const col = sortColumn(sortBy);
  const order = sortDir === "DESC" ? desc(col) : asc(col);

  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = await context.db
    .select({
      id: cards.id,
      deckId: cards.deckId,
      folderTitle: decks.title,
      frontText: cards.frontText,
      backText: cards.backText,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
      suspended: cards.suspended,
      flag: cards.flag,
      interval: reviewStates.interval,
      repetitionCount: reviewStates.repetitionCount,
      easeFactor: reviewStates.easeFactor,
      dueDate: reviewStates.dueDate,
    })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .innerJoin(
      reviewStates,
      and(eq(reviewStates.cardId, cards.id), eq(reviewStates.userId, userId)),
    )
    .where(where)
    .orderBy(order, asc(cards.id))
    .limit(limit)
    .offset(offset);

  const allDecks = await loadUserDecks(context.db, userId);
  const deckById = new Map(allDecks.map((d) => [d.id, d]));

  const tagMap = await loadTagsForCards(
    context.db,
    userId,
    rows.map((r) => r.id),
  );

  const items: BrowseCardRow[] = rows.map((row) => ({
    id: row.id,
    deckId: row.deckId,
    folderTitle: row.folderTitle,
    folderPath: buildFolderPath(row.deckId, deckById),
    frontText: row.frontText,
    backText: row.backText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    suspended: row.suspended,
    flag: row.flag,
    tags: tagMap.get(row.id) ?? [],
    interval: row.interval,
    repetitionCount: row.repetitionCount,
    easeFactor: row.easeFactor,
    dueDate: row.dueDate,
  }));

  return { total, items };
}

export async function moveCardsForUser(
  context: GraphQLContext,
  userId: string,
  cardIds: string[],
  targetDeckId: string,
): Promise<number> {
  if (cardIds.length === 0) return 0;
  const capped = cardIds.slice(0, 500);
  const [target] = await context.db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, targetDeckId), eq(decks.userId, userId)))
    .limit(1);
  if (!target) {
    throw new Error("Target folder not found");
  }

  const owned = await context.db
    .select({ id: cards.id })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(decks.userId, userId), inArray(cards.id, capped)));

  const ownedIds = owned.map((r) => r.id);
  if (ownedIds.length === 0) return 0;

  await context.db
    .update(cards)
    .set({ deckId: targetDeckId, updatedAt: new Date() })
    .where(inArray(cards.id, ownedIds));

  return ownedIds.length;
}

export type DuplicateGroup = {
  normalizedFront: string;
  sampleFront: string;
  cardIds: string[];
  count: number;
};

export async function findDuplicateCardGroups(
  context: GraphQLContext,
  userId: string,
  folderId?: string | null,
  includeSubfolders = true,
): Promise<DuplicateGroup[]> {
  const scopeDeckIds = folderId
    ? await resolveScopeDeckIds(context, userId, folderId, includeSubfolders, [])
    : null;
  if (scopeDeckIds === null && folderId) {
    return [];
  }

  const conditions: SQL[] = [eq(decks.userId, userId)];
  if (scopeDeckIds) {
    if (scopeDeckIds.length === 0) return [];
    conditions.push(inArray(cards.deckId, scopeDeckIds));
  }

  const rows = await context.db
    .select({ id: cards.id, frontText: cards.frontText })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(...conditions));

  const buckets = new Map<string, { sampleFront: string; cardIds: string[] }>();
  for (const row of rows) {
    const key = normalizeCardTextForDuplicate(row.frontText);
    if (!key) continue;
    const bucket = buckets.get(key) ?? { sampleFront: row.frontText, cardIds: [] };
    bucket.cardIds.push(row.id);
    buckets.set(key, bucket);
  }

  const groups: DuplicateGroup[] = [];
  for (const [normalizedFront, bucket] of buckets) {
    if (bucket.cardIds.length < 2) continue;
    groups.push({
      normalizedFront,
      sampleFront: bucket.sampleFront,
      cardIds: bucket.cardIds,
      count: bucket.cardIds.length,
    });
  }
  groups.sort((a, b) => b.count - a.count || a.sampleFront.localeCompare(b.sampleFront));
  return groups;
}

export async function findReplaceInCardsForUser(
  context: GraphQLContext,
  userId: string,
  opts: {
    folderId?: string | null;
    includeSubfolders?: boolean;
    cardIds?: string[] | null;
    find: string;
    replace: string;
    useRegex?: boolean;
    field: "FRONT" | "BACK" | "BOTH";
  },
): Promise<number> {
  let ids = opts.cardIds?.filter(Boolean) ?? [];
  if (ids.length === 0) {
    const scopeDeckIds = await resolveScopeDeckIds(
      context,
      userId,
      opts.folderId ?? null,
      opts.includeSubfolders !== false,
      [],
    );
    const conditions: SQL[] = [eq(decks.userId, userId)];
    if (scopeDeckIds) {
      if (scopeDeckIds.length === 0) return 0;
      conditions.push(inArray(cards.deckId, scopeDeckIds));
    }
    const rows = await context.db
      .select({ id: cards.id, frontText: cards.frontText, backText: cards.backText })
      .from(cards)
      .innerJoin(decks, eq(cards.deckId, decks.id))
      .where(and(...conditions));
    ids = rows
      .filter((row) => textMatchesFind(row, opts.find, opts.useRegex, opts.field))
      .map((r) => r.id);
  }

  if (ids.length === 0) return 0;

  const rows = await context.db
    .select({ id: cards.id, frontText: cards.frontText, backText: cards.backText })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(decks.userId, userId), inArray(cards.id, ids.slice(0, 500))));

  let updated = 0;
  for (const row of rows) {
    const next = applyReplace(row, opts.find, opts.replace, opts.useRegex, opts.field);
    if (next.frontText === row.frontText && next.backText === row.backText) continue;
    await context.db
      .update(cards)
      .set({
        frontText: next.frontText,
        backText: next.backText,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, row.id));
    updated++;
  }
  return updated;
}

function textMatchesFind(
  row: { frontText: string; backText: string },
  find: string,
  useRegex: boolean | undefined,
  field: "FRONT" | "BACK" | "BOTH",
): boolean {
  const test = (text: string) => {
    if (useRegex) {
      try {
        return new RegExp(find).test(text);
      } catch {
        return false;
      }
    }
    return text.includes(find);
  };
  if (field === "FRONT") return test(row.frontText);
  if (field === "BACK") return test(row.backText);
  return test(row.frontText) || test(row.backText);
}

function applyReplace(
  row: { frontText: string; backText: string },
  find: string,
  replace: string,
  useRegex: boolean | undefined,
  field: "FRONT" | "BACK" | "BOTH",
): { frontText: string; backText: string } {
  const repl = (text: string) => {
    if (useRegex) {
      try {
        return text.replace(new RegExp(find, "g"), replace);
      } catch {
        return text;
      }
    }
    return text.split(find).join(replace);
  };
  return {
    frontText: field === "BACK" ? row.frontText : repl(row.frontText),
    backText: field === "FRONT" ? row.backText : repl(row.backText),
  };
}
