import type { RenderContext } from "./types.js";

const FIELD_RE = /\{\{([^}]+)\}\}/g;
const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs;
const CONDITIONAL_RE = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const NEG_CONDITIONAL_RE = /\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

function resolveSpecialField(name: string, ctx: RenderContext): string {
  switch (name.toLowerCase()) {
    case "tags":
      return ctx.tags?.join(" ") ?? "";
    case "deck":
    case "subdeck":
      return ctx.deckName ?? "";
    case "type":
      return ctx.noteTypeName ?? "";
    case "card":
      return ctx.templateName ?? "";
    default:
      return "";
  }
}

function fieldValue(
  fields: Map<string, string>,
  token: string,
  ctx: RenderContext,
  reveal: boolean,
): string {
  const trimmed = token.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "frontside") {
    return fields.get("__frontside__") ?? "";
  }

  const clozeMatch = /^cloze:(.+)$/i.exec(trimmed);
  if (clozeMatch) {
    const raw = fields.get(clozeMatch[1]!.trim()) ?? "";
    return raw;
  }

  const hintMatch = /^hint:(.+)$/i.exec(trimmed);
  if (hintMatch) {
    const fieldName = hintMatch[1]!.trim();
    const content = fields.get(fieldName) ?? "";
    if (!content) return "";
    return reveal
      ? content
      : `<a class="kiri-hint" href="#" onclick="return false;">show ${fieldName}</a>`;
  }

  const typeMatch = /^type:(.+)$/i.exec(trimmed);
  if (typeMatch) {
    const fieldName = typeMatch[1]!.trim();
    if (reveal) {
      return fields.get(fieldName) ?? "";
    }
    return `<input type="text" class="kiri-type-in" data-field="${fieldName}" autocomplete="off" />`;
  }

  const textMatch = /^text:(.+)$/i.exec(trimmed);
  if (textMatch) {
    return stripHtml(fields.get(textMatch[1]!.trim()) ?? "");
  }

  if (/^tts\s/i.test(trimmed)) {
    return "";
  }

  if (["tags", "deck", "subdeck", "type", "card"].includes(lower)) {
    return resolveSpecialField(lower, ctx);
  }

  const name = trimmed.replace(/^(?:furigana|kana|kanji):/i, "").trim();
  return fields.get(name) ?? "";
}

function applyConditionals(template: string, fields: Map<string, string>): string {
  let out = template.replace(CONDITIONAL_RE, (_m, name: string, inner: string) =>
    (fields.get(name.trim()) ?? "").trim() ? inner : "",
  );
  out = out.replace(NEG_CONDITIONAL_RE, (_m, name: string, inner: string) =>
    (fields.get(name.trim()) ?? "").trim() ? "" : inner,
  );
  return out;
}

function applyCloze(text: string, activeOrd: number | null, reveal: boolean): string {
  return text.replace(CLOZE_RE, (_m, n: string, answer: string, _hint?: string) => {
    const index = Number(n);
    if (!reveal && activeOrd !== null && index === activeOrd + 1) {
      return `[[${answer}]]`;
    }
    return answer;
  });
}

export function renderTemplate(
  template: string,
  fields: Map<string, string>,
  clozeOrd: number | null,
  reveal: boolean,
  ctx: RenderContext = {},
): string {
  const withCond = applyConditionals(template, fields);
  const withFields = withCond.replace(FIELD_RE, (_m, token: string) =>
    fieldValue(fields, String(token), ctx, reveal),
  );
  return applyCloze(withFields, clozeOrd, reveal);
}

export function renderCardSides(
  qfmt: string,
  afmt: string,
  fields: Map<string, string>,
  clozeOrd: number | null,
  ctx: RenderContext = {},
): { front: string; back: string } {
  const front = renderTemplate(qfmt, fields, clozeOrd, false, ctx);
  const withFront = new Map(fields);
  withFront.set("__frontside__", front);
  const back = renderTemplate(afmt, withFront, clozeOrd, true, ctx);
  return { front, back };
}

/** First `type:Field` name in question template (for study UI). */
export function extractTypeInField(qfmt: string): string | null {
  const match = /type:([^}\s]+)/i.exec(qfmt);
  return match ? match[1]!.trim() : null;
}
