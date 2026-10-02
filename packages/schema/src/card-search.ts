export type SearchComposeMode = "and" | "or" | "not";

export type ParsedCardSearch = {
  textTerms: string[];
  excludeTextTerms: string[];
  deckTitles: string[];
  excludeDeckTitles: string[];
  folderIds: string[];
  isDue?: boolean;
  isNew?: boolean;
  isSuspended?: boolean;
  tagNone?: boolean;
  tags: string[];
  excludeTags: string[];
  flags: number[];
  addedWithinDays?: number;
  editedWithinDays?: number;
};

function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < query.length) {
    while (i < query.length && /\s/.test(query[i]!)) i++;
    if (i >= query.length) break;
    if (query[i] === '"') {
      i++;
      let s = "";
      while (i < query.length && query[i] !== '"') {
        s += query[i];
        i++;
      }
      if (query[i] === '"') i++;
      if (s.trim()) tokens.push(s.trim());
      continue;
    }
    let s = "";
    while (i < query.length && !/\s/.test(query[i]!)) {
      s += query[i];
      i++;
    }
    if (s) tokens.push(s);
  }
  return tokens;
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
}

/** Parse Anki-inspired card search syntax for Browse. */
export function parseCardSearchQuery(raw: string): ParsedCardSearch {
  const result: ParsedCardSearch = {
    textTerms: [],
    excludeTextTerms: [],
    deckTitles: [],
    excludeDeckTitles: [],
    folderIds: [],
    tags: [],
    excludeTags: [],
    flags: [],
  };

  for (const token of tokenize(raw.trim())) {
    let negated = false;
    let body = token;
    if (body.startsWith("-") && body.length > 1) {
      negated = true;
      body = body.slice(1);
    }

    const colon = body.indexOf(":");
    if (colon > 0) {
      const key = body.slice(0, colon).toLowerCase();
      const value = unquote(body.slice(colon + 1));
      switch (key) {
        case "deck":
        case "folder": {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              value,
            );
          if (isUuid) {
            if (!negated) result.folderIds.push(value);
          } else if (negated) {
            result.excludeDeckTitles.push(value);
          } else {
            result.deckTitles.push(value);
          }
          continue;
        }
        case "is": {
          const v = value.toLowerCase();
          if (v === "due") result.isDue = negated ? false : true;
          else if (v === "new") result.isNew = negated ? false : true;
          else if (v === "suspended") result.isSuspended = negated ? false : true;
          continue;
        }
        case "tag": {
          if (value.toLowerCase() === "none") {
            result.tagNone = !negated;
          } else if (negated) {
            result.excludeTags.push(value);
          } else {
            result.tags.push(value);
          }
          continue;
        }
        case "flag": {
          const n = Number.parseInt(value, 10);
          if (!Number.isNaN(n) && n >= 0 && n <= 7 && !negated) {
            result.flags.push(n);
          }
          continue;
        }
        case "added": {
          const n = Number.parseInt(value, 10);
          if (!Number.isNaN(n) && n >= 0 && !negated) {
            result.addedWithinDays = n;
          }
          continue;
        }
        case "edited": {
          const n = Number.parseInt(value, 10);
          if (!Number.isNaN(n) && n >= 0 && !negated) {
            result.editedWithinDays = n;
          }
          continue;
        }
        default:
          break;
      }
    }

    if (negated) {
      result.excludeTextTerms.push(body);
    } else {
      result.textTerms.push(body);
    }
  }

  return result;
}

/** Append a folder/deck token when clicking the Browse sidebar. */
export function appendSearchToken(
  query: string,
  token: string,
  mode: SearchComposeMode = "and",
): string {
  const trimmed = query.trim();
  const escaped = token.replace(/"/g, '\\"');
  const piece = token.includes(":")
    ? token.includes(" ")
      ? `"${escaped}"`
      : token
    : token.includes(" ")
      ? `deck:"${escaped}"`
      : `deck:${token}`;
  if (!trimmed) return piece;
  if (mode === "or") return `${trimmed} OR ${piece}`;
  if (mode === "not") return `${trimmed} -${piece}`;
  return `${trimmed} ${piece}`;
}

export function folderIdToken(folderId: string): string {
  return `folder:${folderId}`;
}

/** Normalize front text for duplicate detection (strip markup, lowercase, collapse space). */
export function normalizeCardTextForDuplicate(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
