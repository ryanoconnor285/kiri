import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApkg, TINY_PNG } from "./build-apkg.js";
import { parseApkg } from "./parse.js";

test("parses a basic Anki package into front/back cards", async () => {
  const apkg = await buildApkg({
    notes: [
      { fields: ["Glycine", "Gly, G, the only achiral amino acid"] },
      { fields: ["Alanine", "Ala, A"] },
      { fields: ["H2SO4", "Sulfuric acid"] },
    ],
  });

  const parsed = await parseApkg(apkg);
  assert.equal(parsed.cards.length, 3);
  assert.equal(parsed.skippedCount, 0);
  assert.equal(parsed.cards[0]?.frontText, "Glycine");
  assert.equal(parsed.cards[0]?.backText.includes("Gly, G"), true);
  assert.equal(parsed.cards[1]?.frontText, "Alanine");
  assert.match(parsed.cards[2]?.frontText ?? "", /H.*2.*S.*O.*4|H2SO4/);
});

test("inlines package images into the card HTML", async () => {
  const apkg = await buildApkg({
    notes: [{ fields: ['Glycine <img src="glycine.png">', "Gly, G"] }],
    media: { "glycine.png": new Uint8Array(TINY_PNG) },
  });

  const parsed = await parseApkg(apkg);
  assert.equal(parsed.cards.length, 1);
  assert.match(parsed.cards[0]?.frontText ?? "", /data:image\/png;base64,/);
  assert.match(parsed.cards[0]?.frontText ?? "", /<img/i);
});

test("renders cloze deletions as [...] on the front", async () => {
  const apkg = await buildApkg({
    cloze: true,
    notes: [{ fields: ["{{c1::Glycine}} is the smallest amino acid"] }],
  });

  const parsed = await parseApkg(apkg);
  assert.equal(parsed.cards.length, 1);
  assert.match(parsed.cards[0]?.frontText ?? "", /\[\.\.\.\]/);
  assert.match(parsed.cards[0]?.backText ?? "", /Glycine/);
  assert.equal(parsed.cards[0]?.frontText.includes("Glycine is the"), false);
});

test("rejects a file that is not a zip", async () => {
  await assert.rejects(() => parseApkg(Buffer.from("not-a-zip")), /not a valid Anki package/i);
});
