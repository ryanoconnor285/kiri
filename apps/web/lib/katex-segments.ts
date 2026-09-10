export type KatexSegment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

const DELIM_RE =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

export function splitKatexSegments(text: string): KatexSegment[] {
  const segments: KatexSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(DELIM_RE.source, "g");
  while ((match = re.exec(text))) {
    if (match.index > last) {
      segments.push({ type: "text", value: text.slice(last, match.index) });
    }
    // Only $$...$$ and \[...\] are display. $...$ and \(...\) stay inline.
    const display = Boolean(match[1] ?? match[2]);
    const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    segments.push({ type: "math", value, display });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  if (segments.length === 0) {
    segments.push({ type: "text", value: text });
  }
  return segments;
}

export function isBareLatex(text: string): boolean {
  const trimmed = text.trim();
  return /\\[a-zA-Z]+\{/.test(trimmed) && !/\$|\\\(|\\\[/.test(trimmed);
}

export function isFormulaLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes("\n")) return false;
  if (isBareLatex(trimmed)) return true;
  if (trimmed.length > 80) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 6) return false;
  if (/\b[A-Za-z]{4,}\b.*\b[A-Za-z]{4,}\b/.test(trimmed) && !/[=^\\]/.test(trimmed)) {
    return false;
  }
  return /[=^_]/.test(trimmed) && /[A-Za-z]/.test(trimmed);
}
