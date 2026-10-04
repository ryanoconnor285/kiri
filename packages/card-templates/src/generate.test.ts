import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILTIN_NOTE_MODELS } from "./builtins.js";
import { generateCardsFromNote } from "./generate.js";

test("basic reversed produces two cards", () => {
  const model = BUILTIN_NOTE_MODELS.find((m) => m.slug === "basic-reversed")!;
  const cards = generateCardsFromNote(model.kind, model.templates, {
    Front: "Hello",
    Back: "World",
  });
  assert.equal(cards.length, 2);
});

test("cloze produces one card per number", () => {
  const model = BUILTIN_NOTE_MODELS.find((m) => m.slug === "cloze")!;
  const cards = generateCardsFromNote(model.kind, model.templates, {
    Text: "{{c1::A}} and {{c2::B}}",
    "Back Extra": "hint",
  });
  assert.equal(cards.length, 2);
});

test("basic [[blanks]] stay on one card", () => {
  const model = BUILTIN_NOTE_MODELS.find((m) => m.slug === "basic")!;
  const cards = generateCardsFromNote(model.kind, model.templates, {
    Front: "Y [[increases]] as X [[decreases]]",
    Back: "Le Chatelier",
  });
  assert.equal(cards.length, 1);
  assert.match(cards[0]!.front, /\[\[increases\]\]/);
  assert.match(cards[0]!.front, /\[\[decreases\]\]/);
});

test("cloze [[blanks]] become one card per word", () => {
  const model = BUILTIN_NOTE_MODELS.find((m) => m.slug === "cloze")!;
  const cards = generateCardsFromNote(model.kind, model.templates, {
    Text: "Y [[increases]] as X [[decreases]]",
    "Back Extra": "",
  });
  assert.equal(cards.length, 2);
  assert.match(cards[0]!.front, /\[\[increases\]\]/);
  assert.match(cards[0]!.front, /decreases/);
  assert.doesNotMatch(cards[0]!.front, /\[\[decreases\]\]/);
});
