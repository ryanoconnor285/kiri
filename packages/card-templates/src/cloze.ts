const CLOZE_NUM_RE = /\{\{c(\d+)::/gs;

/** Distinct cloze numbers (1-based) in field text, sorted ascending. */
export function distinctClozeNumbers(text: string): number[] {
  const found = new Set<number>();
  CLOZE_NUM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLOZE_NUM_RE.exec(text)) !== null) {
    found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
}

export function clozeFieldNameFromModel(kind: string, fields: Map<string, string>): string {
  if (kind === "cloze") {
    if (fields.has("Text")) return "Text";
    const first = [...fields.keys()][0];
    return first ?? "Text";
  }
  return "Text";
}
