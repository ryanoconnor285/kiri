const SCRIPT_RE = /<script[\s\S]*?<\/script>/gi;
const STYLE_RE = /<style[\s\S]*?<\/style>/gi;
const EVENT_RE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_RE = /javascript:/gi;
const SOUND_RE = /\[sound:[^\]]+\]/gi;

export function sanitizeAnkiHtml(html: string): string {
  return html
    .replace(SCRIPT_RE, "")
    .replace(STYLE_RE, "")
    .replace(EVENT_RE, "")
    .replace(JS_URL_RE, "")
    .replace(SOUND_RE, "")
    .trim();
}

export function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
