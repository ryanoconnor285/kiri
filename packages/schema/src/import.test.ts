import assert from "node:assert/strict";
import { test } from "node:test";
import { stubAiImport } from "./index.js";

test("splits blank-line Q/A blocks", () => {
  const cards = stubAiImport("H2SO4\nSulfuric acid\n\nGlycine\nGly, G");
  assert.equal(cards.length, 2);
  assert.match(cards[0]!.front_text, /H/);
  assert.equal(cards[0]!.back_text, "Sulfuric acid");
  assert.equal(cards[1]!.front_text, "Glycine");
});

test("splits Front | Back lines", () => {
  const cards = stubAiImport("Methionine | Met\nAlanine | Ala");
  assert.equal(cards.length, 2);
  assert.equal(cards[0]!.back_text, "Met");
});

test("reads Front:/Back: labels", () => {
  const cards = stubAiImport("Front: What is Met?\nBack: Methionine");
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.front_text, "What is Met?");
  assert.equal(cards[0]!.back_text, "Methionine");
});

test("returns no cards for a lone sentence", () => {
  assert.equal(stubAiImport("just a blob of notes").length, 0);
});

test("splits a second question in the same block", () => {
  const cards = stubAiImport(
    "What lowers enthalpy ($\\Delta H < 0$)?\nProtonating $R-O^{-}$.\nWhat raises entropy ($\\Delta S > 0$)?\nCleaving a polymer.",
  );
  assert.equal(cards.length, 2);
  assert.match(cards[0]!.front_text, /enthalpy/);
  assert.match(cards[1]!.front_text, /entropy/);
});
