# Note types and card templates

Kiri stores flashcards as **collection notes** (field data) plus generated **cards** (schedulable rows), similar to Anki note types and templates. Handwriting **notebooks** remain separate (`notes` / `note_pages`).

## Built-in note types

Seeded per user on first `noteModels` query:

- Basic, reversed, optional reverse, type-in-answer, Cloze, **Multiple choice**, Image Occlusion (IO editor still iPad-first).

Manage types at **`/note-types`** (web). Clone a type to customize fields, CSS, and `qfmt`/`afmt` templates.

## Multiple choice

Use the **Multiple choice** note type when adding a note (`/decks/[id]/add-note`):

| Field | Purpose |
|-------|---------|
| Question | Stem (KaTeX/HTML ok) |
| Choices | One option per line |
| Correct | Comma-separated **0-based** indices (e.g. `0,2,3` for check-all-that-apply) |
| AllowMultiple | `yes` / `1` for multi-select; auto-on if multiple correct indices |
| Explanation | Shown after **Check answer** |

During **study**, options are **shuffled on every presentation**. When you mark a card **Wrong**, it returns to the back of the session queue with a new shuffle (web: `presentations` counter in session meta; same on iOS).

Correct indices are only returned from `cardStudyRender(revealed: true)` after the learner checks the answer.

## Study modes

`cardStudyRender` returns `studyMode`:

- `STANDARD` — tap to flip
- `TYPE_IN` — input + check (Basic type-in template)
- `MULTIPLE_CHOICE` — checkbox/radio UI

Scheduling still uses Kiri **Right / Wrong** (not Anki’s four-button SM-2 UI).

## Import

`.apkg` import defaults to **structured** mode (`structured=true`): Anki models become note types, notes become collection notes, cards regenerate from templates. Append `?structured=0` to fall back to flat front/back rows.

Run **`pnpm db:migrate`** for migration `0004_note_types` before using note types on a database.

## Kiri vs Anki

See [browse.md](./browse.md) for Browse. Differences: Right/Wrong study queue, no per-card delete without editing templates, JS in templates sanitized on web (no arbitrary script in the main DOM).
