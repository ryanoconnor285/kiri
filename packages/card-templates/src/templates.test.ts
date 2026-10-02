import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCardSides } from "./templates.js";

test("optional reverse empty skips second card front", () => {
  const fields = new Map([
    ["Front", "Q"],
    ["Back", "A"],
    ["Add Reverse", ""],
  ]);
  const { front } = renderCardSides(
    "{{#Add Reverse}}{{Back}}{{/Add Reverse}}",
    "{{Front}}",
    fields,
    null,
  );
  assert.equal(front.trim(), "");
});

test("type filter renders input on front", () => {
  const fields = new Map([
    ["Front", "Capital of France?"],
    ["Back", "Paris"],
  ]);
  const { front } = renderCardSides("{{Front}}\n{{type:Back}}", "{{Back}}", fields, null);
  assert.match(front, /kiri-type-in/);
});
