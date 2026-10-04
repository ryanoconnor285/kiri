import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expandBracketBlanksToCloze,
  hasBracketBlanks,
  parenthesesToBlanks,
  splitBlankSegments,
} from "./blanks.ts";

test("parenthesesToBlanks wraps short groups", () => {
  const out = parenthesesToBlanks("Y (increases) as X (decreases)");
  assert.equal(out, "Y [[increases]] as X [[decreases]]");
});

test("splitBlankSegments keeps surrounding text", () => {
  const parts = splitBlankSegments("Y [[increases]] as X [[decreases]]");
  assert.deepEqual(parts, [
    { type: "text", value: "Y " },
    { type: "blank", value: "increases" },
    { type: "text", value: " as X " },
    { type: "blank", value: "decreases" },
  ]);
});

test("expandBracketBlanksToCloze numbers after existing clozes", () => {
  const out = expandBracketBlanksToCloze("{{c1::foo}} then [[bar]]");
  assert.equal(out, "{{c1::foo}} then {{c2::bar}}");
});

test("parenthesesToBlanks skips math and long groups", () => {
  assert.equal(parenthesesToBlanks("rate ($k$)"), "rate ($k$)");
  const long = `(${"a".repeat(49)})`;
  assert.equal(parenthesesToBlanks(`keep ${long}`), `keep ${long}`);
});

test("hasBracketBlanks", () => {
  assert.equal(hasBracketBlanks("plain"), false);
  assert.equal(hasBracketBlanks("hide [[this]]"), true);
});
