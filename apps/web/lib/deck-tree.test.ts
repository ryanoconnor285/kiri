import assert from "node:assert/strict";
import { test } from "node:test";
import { collectSubtreeDeckIds, computeSubtreeImpact } from "./deck-tree.ts";

const decks = [
  { id: "root", parentId: null, title: "Root", cardCount: 1 },
  { id: "a", parentId: "root", title: "A", cardCount: 2 },
  { id: "b", parentId: "a", title: "B", cardCount: 3 },
];

test("collectSubtreeDeckIds includes nested folders", () => {
  assert.deepEqual(collectSubtreeDeckIds(decks, "root").sort(), ["a", "b", "root"]);
  assert.deepEqual(collectSubtreeDeckIds(decks, "a").sort(), ["a", "b"]);
});

test("computeSubtreeImpact sums direct card counts", () => {
  const impact = computeSubtreeImpact(decks, "root");
  assert.equal(impact.subfolderCount, 2);
  assert.equal(impact.totalCards, 6);
});
