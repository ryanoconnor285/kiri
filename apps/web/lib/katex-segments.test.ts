import assert from "node:assert/strict";
import { test } from "node:test";
import { splitKatexSegments } from "./katex-segments.ts";

test("$math$ inside a sentence is inline, not display", () => {
  const segments = splitKatexSegments(
    "What structural changes cause a decrease in enthalpy ($\\Delta H < 0$)?",
  );
  assert.deepEqual(
    segments.map((segment) =>
      segment.type === "math" ? { type: "math", display: segment.display, value: segment.value } : segment,
    ),
    [
      { type: "text", value: "What structural changes cause a decrease in enthalpy (" },
      { type: "math", display: false, value: "\\Delta H < 0" },
      { type: "text", value: ")?" },
    ],
  );
});

test("multiple $math$ spans in one answer stay inline", () => {
  const segments = splitKatexSegments(
    "Protonating a negative species (e.g., $R-O^- \\rightarrow R-OH$) near $Zn^{2+}$.",
  );
  const math = segments.filter((segment) => segment.type === "math");
  assert.equal(math.length, 2);
  assert.ok(math.every((segment) => segment.type === "math" && segment.display === false));
});

test("$$ and \\[ \\] are the only display delimiters", () => {
  const dollars = splitKatexSegments("See $$E=mc^2$$ on its own.");
  const display = dollars.find((segment) => segment.type === "math");
  assert.equal(display?.type === "math" && display.display, true);

  const paren = splitKatexSegments("See \\(E=mc^2\\) in the sentence.");
  const inline = paren.find((segment) => segment.type === "math");
  assert.equal(inline?.type === "math" && inline.display, false);

  const bracket = splitKatexSegments("See \\[E=mc^2\\] as a block.");
  const block = bracket.find((segment) => segment.type === "math");
  assert.equal(block?.type === "math" && block.display, true);
});
