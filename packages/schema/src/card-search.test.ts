import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendSearchToken,
  normalizeCardTextForDuplicate,
  parseCardSearchQuery,
} from "./card-search.js";

test("parseCardSearchQuery plain text", () => {
  const p = parseCardSearchQuery("mitochondria ATP");
  assert.deepEqual(p.textTerms, ["mitochondria", "ATP"]);
});

test("parseCardSearchQuery deck and is filters", () => {
  const p = parseCardSearchQuery('deck:"Biochemistry" is:due is:new -orphan');
  assert.deepEqual(p.deckTitles, ["Biochemistry"]);
  assert.equal(p.isDue, true);
  assert.equal(p.isNew, true);
  assert.deepEqual(p.excludeTextTerms, ["orphan"]);
});

test("parseCardSearchQuery tag and flag", () => {
  const p = parseCardSearchQuery("tag:exam flag:2 tag:none");
  assert.deepEqual(p.tags, ["exam"]);
  assert.deepEqual(p.flags, [2]);
  assert.equal(p.tagNone, true);
});

test("appendSearchToken modes", () => {
  assert.equal(appendSearchToken("", "Bio", "and"), "deck:Bio");
  assert.equal(appendSearchToken("a", "b", "or"), "a OR deck:b");
  assert.equal(appendSearchToken("a", "deck:x", "not"), "a -deck:x");
});

test("normalizeCardTextForDuplicate", () => {
  assert.equal(
    normalizeCardTextForDuplicate("  <b>Hello</b>  World "),
    "hello world",
  );
});
