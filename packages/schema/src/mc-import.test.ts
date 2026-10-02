import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatMcImportPreviewBack,
  parseMultipleChoiceImport,
} from "./mc-import.js";

const sample = `
id="v0o0nr"
Question: Which factors contribute to protein stability? Check all that are correct.

Choices:
0. van der Waals in the core

release of cage water around hydrophobics
hydrogen bonding in helices
surface H-bonds to solvent
more microstates when folded

Correct: 0,1,2

AllowMultiple: yes

id="v0o0nr"
Question: Which factor is MOST important?

Choices:
0. van der Waals in the core

release of cage water
helix sidechain contacts
intra-helix H-bonds
surface solvent H-bonds
folded microstates

Correct: 1

AllowMultiple: no
`.trim();

test("parseMultipleChoiceImport reads Question/Choices/Correct blocks", () => {
  const notes = parseMultipleChoiceImport(sample);
  assert.equal(notes.length, 2);
  assert.equal(notes[0]!.choices.length, 5);
  assert.deepEqual(notes[0]!.correctIndices, [0, 1, 2]);
  assert.equal(notes[0]!.allowMultiple, true);
  assert.deepEqual(notes[1]!.correctIndices, [1]);
  assert.equal(notes[1]!.allowMultiple, false);
  assert.ok(formatMcImportPreviewBack(notes[0]!).includes("van der Waals"));
});

test("returns empty when not multiple-choice format", () => {
  assert.equal(parseMultipleChoiceImport("Front\nBack").length, 0);
});
