# Kiri product requirements

Kiri is a science study app: **GoodNotes-style handwritten notebooks** and **Anki-style flashcards** in the same folder tree. Students organize coursework however they want (course → unit → lecture), write paged notes, and review cards with spaced repetition.

This document is the product north star. **P0** is what we are building now. Later phases are specified so we do not paint ourselves into a corner.

---

## 1. Information architecture

Folders are the only required structure. Names are **user-defined and agnostic** — there is no mandated Subjects → Topics taxonomy.

A folder may contain:

- nested folders
- notebooks
- flashcards

Example:

```text
Biochemistry
  Unit 1
    notebook: Lecture 3 — Glycolysis
    notebook: Pathway sketches
    cards: Hexokinase regulation, … 
  Unit 2
    …
```

GraphQL and the database still use `Deck` / `decks` as the folder table (`parentId` tree). **UI copy says Folder.** Cards and notebooks both belong to a folder via `deckId`.

Study (`dueCount`, due-card fetch) already walks a folder **and its descendants**. That stays.

Do not force a separate “notes app” IA, tabs for Home / Notes / Browse, or renaming folders to “subjects” in data.

---

## 2. Notebooks (paged — not infinite)

### Constraint

**No infinite canvas and no infinite scroll.** A notebook is a finite sequence of **fixed-size pages** (US Letter aspect). Students add pages when they need more paper.

Within a page: pan/zoom is allowed. Writing never extends the page into an unbounded plane.

This is also the performance and sync model: notebook → pages → one `PKDrawing` per page. Autosave, thumbnails, and later PDF export map 1:1 (one app page = one PDF page).

### Page operations

- Add page (append; later: insert after current)
- Delete page (keep at least one page)
- Duplicate page
- Reorder pages
- Per-page paper style (does not rewrite existing strokes)
- Thumbnail rail on iPad; compact page indicator / swipe on iPhone

### Default create

+ New notebook is available from a folder. Tapping it opens a blank first page immediately. Default title from creation date; title is editable without leaving the canvas. Autosave continuously.

### Tools (shared with card pencil editor)

Ballpoint, pencil, fountain, highlighter, pixel/stroke eraser, lasso (iOS 18+), undo/redo, last-used settings, paper: blank / ruled / college ruled / graph / dotted.

P1+: shapes snap, object eraser, typed text on the page, images, PDF import/annotate, OCR / handwriting search.

---

## 3. Flashcards and study

Cards live in the same folders as notebooks.

### Session (current product)

- Load due cards for a folder + descendants.
- **Right** → SM-2 quality 4, card leaves the session queue.
- **Wrong** → no immediate write; card moves to the **back of the queue** this session.
- **Leave** after at least one Wrong on a still-queued card → quality 0.

Do **not** replace this with Again / Hard / Good / Easy in P0. Those are different semantics.

### Card content

Front/back text (KaTeX) and optional PencilKit faces (iPad). Import: text/AI stub and `.apkg`.

P1+: cloze, image occlusion, reverse cards, note→card from a selected region, card→jump to source page (`sourceNoteId` / `sourcePageId` reserved on cards).

---

## 4. Notes ↔ cards (later differentiator)

A student should eventually highlight part of a notebook page and create a flashcard, and from a card jump back to that page. The relationship is preserved in the schema; **UI is not P0**.

AI “generate cards from this note” is also later: suggest cards, student checks which to add.

---

## 5. Platforms and sync

Same GraphQL API + Better Auth for web and iOS.

| Surface | P0 | Later |
|---------|----|--------|
| Folder tree, study, text cards | Web + iOS | — |
| Notebook list in a folder | Web + iOS | — |
| Handwriting notebook editor | **iPad** (PencilKit) | Web canvas editor |
| Card pencil editor | iPad | — |

Changes sync through the API (page blob upserts). Conflict resolution beyond last-write-wins is later.

---

## 6. Phasing

### P0 (this slice)

- PRD aligned with folders + paged notebooks + Right/Wrong study
- `notes` / `note_pages` + GraphQL CRUD
- iPad notebook editor: pages, paper, drawing tools, autosave, title
- Web: list notebooks in a folder (no canvas)

### P1

- Typed text on a page, images
- Duplicate/reorder polish, page thumbnails from strokes
- Note → card from selection; source links in study
- PDF import as pages
- Web notebook viewer (read-only) then editor

### Later

- OCR / handwriting search
- Image occlusion
- Tags, favorites, smart collections
- Audio synced to writing
- Sharing
- Four-button SM-2 UI (only if we deliberately change study semantics)

---

## 7. Science-specific vision (not all P0)

KaTeX on cards (shipped). Paper templates for graphs/Cornell. Equation-aware handwriting recognition. Mechanism diagrams. Image occlusion on pathways. These stay in the vision so engineering choices (page objects, attachments) remain compatible.

---

## 8. Explicitly out of product

- Infinite canvas / infinite scroll notes
- Required subject/topic taxonomy
- A separate Notes product with its own tab bar
- Replacing Right/Wrong with Again/Hard/Good/Easy without an explicit product decision
