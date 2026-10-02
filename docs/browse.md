# Browse window

Browse is a **power-user tool** for searching, editing, and bulk-managing cards across your folder tree. It complements folder detail (flip grid) and study mode—it does not replace them.

## When to use what

| Surface | Best for |
|---------|----------|
| **Folder detail** (`/decks/[id]`) | Browsing cards in one folder, quick flip preview, notebooks |
| **Study** | Due queue and SM-2 reviews |
| **Browse** (`/browse`, iOS **Browse**) | Search, multi-select delete/move, tags, suspend, find/replace, duplicates |

## Web entry

- Link **Browse** on the folders home page
- Keyboard **B** from folders (when focus is not in an input)

## Search syntax

Shared parser: [`packages/schema/src/card-search.ts`](../packages/schema/src/card-search.ts) (Swift: `CardSearch.swift`).

Examples:

- Plain text searches front and back
- `deck:"Organic Chemistry"` or `folder:<uuid>`
- `is:due`, `is:new`, `is:suspended`
- `tag:exam`, `tag:none`, `flag:2`
- `added:7`, `edited:3`
- `-term` excludes plain text; sidebar clicks support Shift (OR) and Alt (NOT) on web

**Live search** (web): optional 300ms debounce, stored in `localStorage` as `kiri-browse-live`.

## Saved searches

Stored per user (`saved_searches` table). Save from the bulk toolbar on web; run from the sidebar.

## Schema additions

Migration `0003_browse_tags`: `cards.suspended`, `cards.flag`, `tags`, `card_tags`, `saved_searches`.

Run `pnpm db:migrate` after deploy.
