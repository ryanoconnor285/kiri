# Client parity (Web + iOS)

Both clients talk to the same GraphQL API and Better Auth endpoints. Keep this table updated when adding features.

| Feature | Web route | iOS screen | Operations |
|---------|-----------|------------|------------|
| Sign in / up | `/login` | `LoginView` | `POST /api/auth/sign-in/email`, `sign-up/email` |
| Sign out | decks header | account menu | `POST /api/auth/sign-out` + clear Keychain |
| Folder tree | `/decks` | `DeckListView` | `decks` query, `createDeck` |
| Folder detail | `/decks/[id]` | `DeckDetailView` | `cards`, `notes`, `createDeck(parentId)`, `upsertCard` |
| Notebooks | folder page (list only) | `NotebookEditorView` | `notes`, `note`, `createNote`, `updateNote`, `upsertNotePage`, `addNotePage`, `deleteNotePage` |
| Study | `/decks/[id]/study` | `StudyView` | `dueCards`, `submitReview` |
| Text import | `/decks/[id]/import` | `ImportView` | `aiImportCards`, batch `upsertCard` |
| Anki import | `/decks/[id]/import` | `ImportView` | `POST /api/import/apkg?deckId=` |
| Card pencil editor | — (web text only) | `CardEditorView` (iPad) | `upsertCard` + base64 pencil fields |

API type name remains `Deck` (folder). UI copy says **folder**. Cards and notebooks both use `deckId`.

## Auth

- **Web:** session cookie via same-origin `/graphql` (Next.js rewrites).
- **iOS:** `Authorization: Bearer <token>` from Better Auth bearer plugin (`set-auth-token` header on sign-in).

## Study session queue

Logic must match between:

- [`apps/web/lib/recall-queue.ts`](../apps/web/lib/recall-queue.ts)
- [`apps/ios/Kiri/Services/RecallQueue.swift`](../apps/ios/Kiri/Services/RecallQueue.swift)

- **Right** → SM-2 quality 4, card leaves the session queue.
- **Wrong** → no immediate write; card moves to the **back** of the session queue.
- **Leave** with cards still queued after at least one Wrong → quality 0 for those cards.

## Notebooks (paged)

- Each notebook is a list of **fixed-size pages** (US Letter aspect). No infinite canvas.
- iOS loads/saves one page `pencilData` blob at a time (same base64 ↔ bytea pattern as cards).
- **Web lists** title, page count, and updated date. Handwriting editing is **iPad / iOS**.
- Paper style is stored per page. Changing it does not rewrite strokes.
- Cards may later point at a source page via nullable `sourceNoteId` / `sourcePageId` (no UI yet).

## GraphQL strings

- Web: inline in page components / `gqlFetch` calls.
- iOS: [`GraphQLOperations.swift`](../apps/ios/Kiri/Services/GraphQLOperations.swift)

When adding a field to a shared query, update both.

## Design system (visual-only)

Shared tokens (light default + `prefers-color-scheme: dark` on web; `ColorScheme` on iOS):

| Token | Light | Use |
|-------|-------|-----|
| Background | `#F7F8FA` | Page chrome |
| Surface | `#FFFFFF` | Cards, lists |
| Accent | `#0E6F7A` | Primary actions |
| Canvas paper | `#FCFBF7` | Flashcard faces, PencilKit canvas |

- **Web:** [`apps/web/app/globals.css`](../apps/web/app/globals.css)
- **iOS:** [`KiriTheme.swift`](../apps/ios/Kiri/Theme/KiriTheme.swift)

**Manual check:** login, folder home + Start study, study round (Wrong requeues), iPad notebook (add page, paper, autosave), web folder shows the notebook in the list.

## Pencil editor (iPad Simulator)

Card pencil: **iPad-only** (`DeckDetailView` → **Edit cards (Pencil)**).

Notebook editor: folder → **New notebook** / existing notebook. iPad thumbnail rail; compact page chrome on all sizes.

Drawing uses **PencilKit** with a **custom leading tool rail** (not the system `PKToolPicker`):

- Ballpoint / pencil / fountain ink; highlighter (marker)
- Eraser **Pixel** (bitmap, S/M/L diameter) or **Stroke** (whole-stroke vector erase)
- **Lasso** on iOS 18+ (`PKLassoTool`)
- Paper styles: blank, ruled, college ruled, graph, dotted
- Last-used tool settings persist in `UserDefaults`
- Undo / redo

- **No Apple Pencil hardware required in Simulator.** `drawingPolicy = .anyInput`.
- System floating `PKToolPicker` is explicitly hidden in custom mode.

Implementation: [`DrawingToolState.swift`](../apps/ios/Kiri/Services/DrawingToolState.swift), [`DrawingToolRail.swift`](../apps/ios/Kiri/Views/DrawingToolRail.swift), [`PencilCanvasView.swift`](../apps/ios/Kiri/Views/PencilCanvasView.swift), [`NotebookEditorView.swift`](../apps/ios/Kiri/Views/NotebookEditorView.swift).

## Staging test checklist

1. Set [`Staging.xcconfig`](../apps/ios/Config/Staging.xcconfig) `KIRI_API_URL` to the Railway **API** domain.
2. Run scheme **Kiri-Staging** on simulator or device.
3. Sign in with the same account as staging web.
4. Folder counts and `dueCount` match web.
5. Complete a study round; due counts decrease on web after refresh.
6. Create a notebook on iOS; it appears on the web folder page after refresh.
7. Edit a card on iPad; changes appear on web.
