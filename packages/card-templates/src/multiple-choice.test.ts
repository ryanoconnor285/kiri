import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseMultipleChoiceFields,
  shuffleIndices,
} from "./multiple-choice.ts";

test("parseMultipleChoiceFields reads lines and comma indices", () => {
  const cfg = parseMultipleChoiceFields({
    Question: "Stem?",
    Choices: "A\nB\nC",
    Correct: "0, 2",
    AllowMultiple: "yes",
    Explanation: "Because.",
  });
  assert.ok(cfg);
  assert.equal(cfg!.choices.length, 3);
  assert.deepEqual(cfg!.correctIndices, [0, 2]);
  assert.equal(cfg!.allowMultiple, true);
});

test("shuffleIndices is deterministic per seed", () => {
  const a = shuffleIndices(6, 0);
  const b = shuffleIndices(6, 0);
  const c = shuffleIndices(6, 1);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual([...a].sort(), [0, 1, 2, 3, 4, 5]);
});
