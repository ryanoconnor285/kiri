const FIELD_RE = /\{\{([^}]+)\}\}/g;
const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs;
const CONDITIONAL_RE = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const NEG_CONDITIONAL_RE = /\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

function fieldValue(fields: Map<string, string>, token: string): string {
  const trimmed = token.trim();
  if (trimmed.toLowerCase() === "frontside") {
    return fields.get("__frontside__") ?? "";
  }
  const clozeMatch = /^cloze:(.+)$/i.exec(trimmed);
  if (clozeMatch) {
    return fields.get(clozeMatch[1]!.trim()) ?? "";
  }
  const name = trimmed.replace(/^(?:text|type|hint|furigana|kana|kanji|tts [^:]+):/i, "").trim();
  return fields.get(name) ?? "";
}

function applyConditionals(template: string, fields: Map<string, string>): string {
  let out = template.replace(CONDITIONAL_RE, (_m, name: string, inner: string) =>
    fieldValue(fields, name) ? inner : "",
  );
  out = out.replace(NEG_CONDITIONAL_RE, (_m, name: string, inner: string) =>
    fieldValue(fields, name) ? "" : inner,
  );
  return out;
}

function applyCloze(text: string, activeOrd: number | null, reveal: boolean): string {
  return text.replace(CLOZE_RE, (_m, n: string, answer: string, hint?: string) => {
    const index = Number(n);
    if (!reveal && activeOrd !== null && index === activeOrd + 1) {
      return hint ? `[${hint}]` : "[...]";
    }
    return answer;
  });
}

export function renderTemplate(
  template: string,
  fields: Map<string, string>,
  clozeOrd: number | null,
  reveal: boolean,
): string {
  const withCond = applyConditionals(template, fields);
  const withFields = withCond.replace(FIELD_RE, (_m, token: string) =>
    fieldValue(fields, String(token)),
  );
  return applyCloze(withFields, clozeOrd, reveal);
}

export function renderCardSides(
  qfmt: string,
  afmt: string,
  fields: Map<string, string>,
  clozeOrd: number | null,
): { front: string; back: string } {
  const front = renderTemplate(qfmt, fields, clozeOrd, false);
  const withFront = new Map(fields);
  withFront.set("__frontside__", front);
  const back = renderTemplate(afmt, withFront, clozeOrd, true);
  return { front, back };
}
