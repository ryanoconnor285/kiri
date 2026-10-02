export type ParsedMcImport = {
  question: string;
  choices: string[];
  correctIndices: number[];
  allowMultiple: boolean;
  explanation: string;
};

export type McImportFieldValues = {
  Question: string;
  Choices: string;
  Correct: string;
  AllowMultiple: string;
  Explanation: string;
};

function parseCorrectIndices(raw: string, max: number): number[] {
  const indices: number[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(n) && n >= 0 && n < max) indices.push(n);
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

function stripChoicePrefix(line: string): string {
  return line.replace(/^\s*\d+[.)]\s*/, "").trim();
}

function parseOneMcBlock(block: string): ParsedMcImport | null {
  const lines = block.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i]!.trim()) i += 1;
  if (i >= lines.length) return null;

  let question = lines[i]!.replace(/^Question\s*:\s*/i, "").trim();
  i += 1;
  if (!question) return null;

  while (i < lines.length && !/^Choices\s*:/i.test(lines[i]!.trim())) {
    const extra = lines[i]!.trim();
    if (extra) question += `\n${extra}`;
    i += 1;
  }
  if (i >= lines.length || !/^Choices\s*:/i.test(lines[i]!.trim())) return null;
  i += 1;

  const choiceLines: string[] = [];
  while (i < lines.length && !/^Correct\s*:/i.test(lines[i]!.trim())) {
    const line = stripChoicePrefix(lines[i]!.trim());
    if (line) choiceLines.push(line);
    i += 1;
  }
  if (i >= lines.length || choiceLines.length < 2) return null;

  const correctLine = lines[i]!.replace(/^Correct\s*:\s*/i, "").trim();
  i += 1;
  const correctIndices = parseCorrectIndices(correctLine, choiceLines.length);
  if (correctIndices.length === 0) return null;

  let allowMultiple = correctIndices.length > 1;
  let explanation = "";
  while (i < lines.length) {
    const line = lines[i]!.trim();
    i += 1;
    if (!line) continue;
    const allow = line.match(/^AllowMultiple\s*:\s*(.+)$/i);
    if (allow) {
      allowMultiple =
        /^(1|yes|true|y)$/i.test(allow[1]!.trim()) || allowMultiple;
      continue;
    }
    const expl = line.match(/^Explanation\s*:\s*(.*)$/i);
    if (expl) {
      explanation = expl[1]!.trim();
      continue;
    }
  }

  return {
    question: question.trim(),
    choices: choiceLines,
    correctIndices,
    allowMultiple,
    explanation,
  };
}

/** Paste format: blocks with Question / Choices / Correct (optional AllowMultiple). */
export function parseMultipleChoiceImport(rawText: string): ParsedMcImport[] {
  const stripped = rawText
    .replace(/^\s*id\s*=\s*["'][^"']*["']\s*$/gm, "")
    .trim();
  if (!/Question\s*:/i.test(stripped) || !/Choices\s*:/i.test(stripped)) {
    return [];
  }

  const blocks = stripped
    .split(/\n(?=Question\s*:)/i)
    .map((b) => b.trim())
    .filter(Boolean);

  const results: ParsedMcImport[] = [];
  for (const block of blocks) {
    const parsed = parseOneMcBlock(block);
    if (parsed) results.push(parsed);
  }
  return results;
}

export function mcImportToFieldValues(note: ParsedMcImport): McImportFieldValues {
  return {
    Question: note.question,
    Choices: note.choices.join("\n"),
    Correct: note.correctIndices.join(","),
    AllowMultiple: note.allowMultiple ? "yes" : "no",
    Explanation: note.explanation,
  };
}

export function formatMcImportPreviewBack(note: ParsedMcImport): string {
  const labels = note.correctIndices
    .map((i) => note.choices[i] ?? `(${i})`)
    .join("; ");
  return `Correct: ${note.correctIndices.join(", ")} — ${labels}`;
}
