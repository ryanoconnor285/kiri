export type BlankSegment =
  | { type: "text"; value: string }
  | { type: "blank"; value: string };

const BLANK_RE = /\[\[([\s\S]+?)\]\]/g;

export function hasBracketBlanks(text: string): boolean {
  BLANK_RE.lastIndex = 0;
  return BLANK_RE.test(text);
}

/** Split `Y [[increases]] as X [[decreases]]` into text and blank segments. */
export function splitBlankSegments(text: string): BlankSegment[] {
  const parts: BlankSegment[] = [];
  BLANK_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = BLANK_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    parts.push({ type: "blank", value: match[1]!.trim() });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: text });
  }
  return parts;
}

/**
 * Turn `Y (increases) as X (decreases)` into `Y [[increases]] as X [[decreases]]`.
 * Skips long groups and math.
 */
export function parenthesesToBlanks(text: string): string {
  return text.replace(/\(([^()]+)\)/g, (full, inner: string) => {
    const trimmed = inner.trim();
    if (!trimmed || trimmed.length > 48) return full;
    if (trimmed.includes("$") || trimmed.includes("[[") || trimmed.includes("]]")) return full;
    if (/^c\d+::/i.test(trimmed)) return full;
    return `[[${trimmed}]]`;
  });
}

/** `[[a]] and [[b]]` → `{{c1::a}} and {{c2::b}}`, starting after existing cloze numbers. */
export function expandBracketBlanksToCloze(text: string): string {
  const existing = new Set<number>();
  const clozeRe = /\{\{c(\d+)::/g;
  let m: RegExpExecArray | null;
  while ((m = clozeRe.exec(text)) !== null) {
    existing.add(Number(m[1]));
  }
  let next = 1;
  while (existing.has(next)) next += 1;
  return text.replace(BLANK_RE, (_full, inner: string) => {
    const n = next;
    existing.add(n);
    next += 1;
    while (existing.has(next)) next += 1;
    return `{{c${n}::${inner.trim()}}}`;
  });
}
