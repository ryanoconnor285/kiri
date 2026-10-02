/** Minimal deck fields for folder-tree helpers (matches GraphQL `decks` list). */
export type DeckTreeNode = {
  id: string;
  parentId: string | null;
  title: string;
  cardCount?: number;
};

export type SubtreeImpact = {
  deckIds: string[];
  /** Nested folders below root, not counting the root deck itself */
  subfolderCount: number;
  totalCards: number;
};

function childrenByParent(decks: DeckTreeNode[]): Map<string | null, DeckTreeNode[]> {
  const map = new Map<string | null, DeckTreeNode[]>();
  for (const deck of decks) {
    const key = deck.parentId ?? null;
    const list = map.get(key) ?? [];
    list.push(deck);
    map.set(key, list);
  }
  return map;
}

/** All deck ids in the subtree rooted at `rootId` (includes root). */
export function collectSubtreeDeckIds(decks: DeckTreeNode[], rootId: string): string[] {
  const byParent = childrenByParent(decks);
  const ids: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const child of byParent.get(id) ?? []) {
      queue.push(child.id);
    }
  }
  return ids;
}

export function computeSubtreeImpact(decks: DeckTreeNode[], rootId: string): SubtreeImpact {
  const deckIds = collectSubtreeDeckIds(decks, rootId);
  const byId = new Map(decks.map((d) => [d.id, d]));
  let totalCards = 0;
  for (const id of deckIds) {
    totalCards += byId.get(id)?.cardCount ?? 0;
  }
  return {
    deckIds,
    subfolderCount: Math.max(0, deckIds.length - 1),
    totalCards,
  };
}

export function deleteDeckConfirmMessage(title: string, impact: SubtreeImpact): string {
  const parts: string[] = [
    `Delete "${title}" and everything inside it?`,
    "",
    "This permanently removes:",
    "• this folder",
  ];
  if (impact.subfolderCount > 0) {
    parts.push(
      `• ${impact.subfolderCount} nested subfolder${impact.subfolderCount === 1 ? "" : "s"}`,
    );
  }
  if (impact.totalCards > 0) {
    parts.push(`• ${impact.totalCards} flashcard${impact.totalCards === 1 ? "" : "s"} in this tree`);
  }
  parts.push("• all notebooks in those folders");
  parts.push("", "This cannot be undone.");
  return parts.join("\n");
}

export function deleteCardConfirmMessage(): string {
  return "Delete this flashcard? This cannot be undone.";
}
