export type MultipleChoiceConfig = {
  choices: string[];
  correctIndices: number[];
  allowMultiple: boolean;
  explanation: string;
};

function parseIndices(raw: string, max: number): number[] {
  const indices: number[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(n) && n >= 0 && n < max) {
      indices.push(n);
    }
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/** Parse Multiple choice fields from a collection note. */
export function parseMultipleChoiceFields(
  fieldValues: Record<string, string>,
): MultipleChoiceConfig | null {
  const question = fieldValues.Question?.trim();
  const choicesRaw = fieldValues.Choices ?? "";
  const choices = choicesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!question || choices.length < 2) return null;

  const correctRaw = fieldValues.Correct ?? fieldValues.CorrectIndices ?? "0";
  const correctIndices = parseIndices(correctRaw, choices.length);
  const allowMultiple =
    /^(1|yes|true|y)$/i.test((fieldValues.AllowMultiple ?? "").trim()) ||
    correctIndices.length > 1;

  return {
    choices,
    correctIndices: correctIndices.length > 0 ? correctIndices : [0],
    allowMultiple,
    explanation: fieldValues.Explanation?.trim() ?? "",
  };
}

/** Fisher–Yates shuffle (deterministic seed optional for tests). */
export function shuffleIndices(length: number, seed: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices;
}
