"use client";

import { appendSearchToken, folderIdToken, type SearchComposeMode } from "@kiri/schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { CardFace } from "@/components/CardFace";
import { useSession } from "@/lib/auth-client";
import { deleteCardConfirmMessage } from "@/lib/deck-tree";
import { gqlFetch } from "@/lib/graphql";

type Deck = {
  id: string;
  parentId: string | null;
  title: string;
};

type BrowseCard = {
  id: string;
  deckId: string;
  folderTitle: string;
  folderPath: string;
  frontText: string;
  backText: string;
  suspended: boolean;
  flag: number;
  tags: string[];
  interval: number;
  repetitionCount: number;
  easeFactor: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};

type SavedSearch = { id: string; name: string; query: string };
type TagRow = { id: string; name: string };
type DuplicateGroup = {
  normalizedFront: string;
  sampleFront: string;
  cardIds: string[];
  count: number;
};

const DECKS_QUERY = `query { decks { id parentId title } }`;
const TAGS_QUERY = `query { tags { id name } }`;
const SAVED_QUERY = `query { savedSearches { id name query } }`;

const SEARCH_QUERY = `
query($query: String, $folderId: String, $includeSubfolders: Boolean, $limit: Int, $offset: Int, $sortBy: String, $sortDir: String) {
  searchCards(query: $query, folderId: $folderId, includeSubfolders: $includeSubfolders, limit: $limit, offset: $offset, sortBy: $sortBy, sortDir: $sortDir) {
    total
    items {
      id deckId folderTitle folderPath frontText backText suspended flag tags
      interval repetitionCount easeFactor dueDate createdAt updatedAt
    }
  }
}`;

const DUPLICATES_QUERY = `
query($folderId: String, $includeSubfolders: Boolean) {
  duplicateCardGroups(folderId: $folderId, includeSubfolders: $includeSubfolders) {
    normalizedFront sampleFront cardIds count
  }
}`;

function formatDue(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function flagColor(flag: number): string | undefined {
  const map: Record<number, string> = {
    1: "#e74c3c",
    2: "#e67e22",
    3: "#f1c40f",
    4: "#2ecc71",
    5: "#3498db",
    6: "#9b59b6",
    7: "#95a5a6",
  };
  return map[flag];
}

export default function BrowsePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [tagList, setTagList] = useState<TagRow[]>([]);
  const [searchText, setSearchText] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [folderScope, setFolderScope] = useState<string | null>(null);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [liveSearch, setLiveSearch] = useState(false);
  const [sortBy, setSortBy] = useState("FRONT");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [rows, setRows] = useState<BrowseCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findRegex, setFindRegex] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Deck[]>();
    for (const deck of decks) {
      const key = deck.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(deck);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [decks]);

  const selectedCard = useMemo(() => {
    if (selected.size !== 1) return null;
    const id = [...selected][0]!;
    return rows.find((r) => r.id === id) ?? null;
  }, [selected, rows]);

  const runSearch = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await gqlFetch<{
          searchCards: { total: number; items: BrowseCard[] } | null;
        }>(SEARCH_QUERY, {
          query: query || null,
          folderId: folderScope,
          includeSubfolders,
          limit: 200,
          offset: 0,
          sortBy,
          sortDir,
        });
        if (!data.searchCards) {
          setError("Folder not found");
          setRows([]);
          setTotal(0);
          return;
        }
        setRows(data.searchCards.items);
        setTotal(data.searchCards.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [folderScope, includeSubfolders, sortBy, sortDir],
  );

  const loadMeta = useCallback(async () => {
    const [deckData, tagData, savedData] = await Promise.all([
      gqlFetch<{ decks: Deck[] }>(DECKS_QUERY),
      gqlFetch<{ tags: TagRow[] }>(TAGS_QUERY),
      gqlFetch<{ savedSearches: SavedSearch[] }>(SAVED_QUERY),
    ]);
    setDecks(deckData.decks);
    setTagList(tagData.tags);
    setSavedSearches(savedData.savedSearches);
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    const live = localStorage.getItem("kiri-browse-live") === "1";
    setLiveSearch(live);
    loadMeta()
      .then(() => runSearch(""))
      .catch((err) => setError(err.message));
  }, [session, isPending, router, loadMeta, runSearch]);

  useEffect(() => {
    if (selectedCard) {
      setEditFront(selectedCard.frontText);
      setEditBack(selectedCard.backText);
    }
  }, [selectedCard]);

  useEffect(() => {
    if (!session?.user) return;
    runSearch(committedQuery);
  }, [sortBy, sortDir, includeSubfolders, folderScope]);

  useEffect(() => {
    if (!liveSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCommittedQuery(searchText);
      runSearch(searchText);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, liveSearch, runSearch]);

  function commitSearch() {
    setCommittedQuery(searchText);
    runSearch(searchText);
  }

  function toggleLive(next: boolean) {
    setLiveSearch(next);
    localStorage.setItem("kiri-browse-live", next ? "1" : "0");
    if (next) runSearch(searchText);
  }

  function appendToken(token: string, mode: SearchComposeMode) {
    const next = appendSearchToken(searchText, token, mode);
    setSearchText(next);
    if (liveSearch) return;
    setCommittedQuery(next);
    runSearch(next);
  }

  function onFolderClick(deck: Deck, e: MouseEvent) {
    let mode: SearchComposeMode = "and";
    if (e.altKey) mode = "not";
    else if (e.shiftKey) mode = "or";
    appendToken(folderIdToken(deck.id), mode);
    setFolderScope(deck.id);
  }

  function renderTree(parentId: string | null, depth: number): ReactNode {
    const list = childrenByParent.get(parentId) ?? [];
    return list.map((deck) => (
      <div key={deck.id}>
        <button
          type="button"
          className={`browse-sidebar-item${folderScope === deck.id ? " is-active" : ""}`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={(e) => onFolderClick(deck, e)}
        >
          {deck.title}
        </button>
        {renderTree(deck.id, depth + 1)}
      </div>
    ));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} card(s)?\n\n${deleteCardConfirmMessage()}`)) return;
    for (const id of ids) {
      await gqlFetch(`mutation($id: String!) { deleteCard(id: $id) }`, { id });
    }
    setSelected(new Set());
    await runSearch(committedQuery);
  }

  async function bulkMove() {
    const ids = [...selected];
    if (!moveTarget || ids.length === 0) return;
    await gqlFetch(`mutation($cardIds: [String!]!, $targetDeckId: String!) {
      moveCards(cardIds: $cardIds, targetDeckId: $targetDeckId)
    }`, { cardIds: ids, targetDeckId: moveTarget });
    setMoveOpen(false);
    setSelected(new Set());
    await runSearch(committedQuery);
  }

  async function bulkSuspend(suspended: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    await gqlFetch(
      `mutation($cardIds: [String!]!, $suspended: Boolean!) {
        setCardsSuspended(cardIds: $cardIds, suspended: $suspended)
      }`,
      { cardIds: ids, suspended },
    );
    await runSearch(committedQuery);
  }

  async function bulkFlag(flag: number) {
    const ids = [...selected];
    if (ids.length === 0) return;
    await gqlFetch(
      `mutation($cardIds: [String!]!, $flag: Int!) { setCardsFlag(cardIds: $cardIds, flag: $flag) }`,
      { cardIds: ids, flag },
    );
    await runSearch(committedQuery);
  }

  async function bulkReset() {
    const ids = [...selected];
    if (ids.length === 0) return;
    await gqlFetch(`mutation($cardIds: [String!]!) { resetCards(cardIds: $cardIds) }`, {
      cardIds: ids,
    });
    await runSearch(committedQuery);
  }

  async function saveCardEdits() {
    if (!selectedCard) return;
    setSaving(true);
    try {
      await gqlFetch(
        `mutation($deckId: String!, $id: String!, $frontText: String!, $backText: String!) {
          upsertCard(deckId: $deckId, id: $id, frontText: $frontText, backText: $backText) { id }
        }`,
        {
          deckId: selectedCard.deckId,
          id: selectedCard.id,
          frontText: editFront,
          backText: editBack,
        },
      );
      await runSearch(committedQuery);
    } finally {
      setSaving(false);
    }
  }

  async function loadDuplicates() {
    const data = await gqlFetch<{ duplicateCardGroups: DuplicateGroup[] }>(DUPLICATES_QUERY, {
      folderId: folderScope,
      includeSubfolders,
    });
    setDuplicates(data.duplicateCardGroups);
  }

  async function runFindReplace() {
    const cardIds = selected.size > 0 ? [...selected] : null;
    await gqlFetch(
      `mutation($find: String!, $replace: String!, $useRegex: Boolean, $field: String, $folderId: String, $includeSubfolders: Boolean, $cardIds: [String!]) {
        findReplaceCards(find: $find, replace: $replace, useRegex: $useRegex, field: $field, folderId: $folderId, includeSubfolders: $includeSubfolders, cardIds: $cardIds)
      }`,
      {
        find: findText,
        replace: replaceText,
        useRegex: findRegex,
        field: "BOTH",
        folderId: folderScope,
        includeSubfolders,
        cardIds,
      },
    );
    setFindOpen(false);
    await runSearch(committedQuery);
  }

  async function saveCurrentSearch() {
    if (!saveSearchName.trim()) return;
    await gqlFetch(
      `mutation($name: String!, $query: String!) {
        createSavedSearch(name: $name, query: $query) { id name query }
      }`,
      { name: saveSearchName.trim(), query: committedQuery || searchText },
    );
    setSaveSearchName("");
    await loadMeta();
  }

  return (
    <div className="browse-shell">
      <header className="browse-topbar">
        <Link href="/decks">← Folders</Link>
        <h1>Browse</h1>
        <span className="muted">Press Enter to search · B from folders opens Browse</span>
      </header>

      <div className="browse-grid">
        <aside className="browse-sidebar">
          <div className="browse-sidebar-section">
            <h2>Saved</h2>
            {savedSearches.length === 0 ? (
              <p className="muted small">No saved searches</p>
            ) : (
              savedSearches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="browse-sidebar-item"
                  onClick={() => {
                    setSearchText(s.query);
                    setCommittedQuery(s.query);
                    runSearch(s.query);
                  }}
                >
                  {s.name}
                </button>
              ))
            )}
          </div>
          <div className="browse-sidebar-section">
            <h2>Folders</h2>
            <button
              type="button"
              className={`browse-sidebar-item${folderScope === null ? " is-active" : ""}`}
              onClick={() => {
                setFolderScope(null);
                runSearch(committedQuery);
              }}
            >
              All folders
            </button>
            {renderTree(null, 0)}
          </div>
          <div className="browse-sidebar-section">
            <h2>Tags</h2>
            {tagList.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="browse-sidebar-item"
                onClick={(e) => appendToken(`tag:${tag.name}`, e.altKey ? "not" : e.shiftKey ? "or" : "and")}
              >
                {tag.name}
              </button>
            ))}
          </div>
          <div className="browse-sidebar-section">
            <h2>Card state</h2>
            {(["is:due", "is:new", "is:suspended"] as const).map((token) => (
              <button
                key={token}
                type="button"
                className="browse-sidebar-item"
                onClick={() => appendToken(token, "and")}
              >
                {token}
              </button>
            ))}
          </div>
          <div className="browse-sidebar-section">
            <h2>Tools</h2>
            <button type="button" className="browse-sidebar-item" onClick={() => setFindOpen(true)}>
              Find / replace…
            </button>
            <button type="button" className="browse-sidebar-item" onClick={() => loadDuplicates()}>
              Find duplicates
            </button>
            {duplicates.length > 0 && (
              <ul className="browse-dup-list">
                {duplicates.slice(0, 8).map((g) => (
                  <li key={g.normalizedFront}>
                    <button
                      type="button"
                      className="browse-sidebar-item"
                      onClick={() => {
                        setSelected(new Set(g.cardIds));
                      }}
                    >
                      {g.count}× {g.sampleFront.slice(0, 40)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="browse-main">
          <div className="browse-toolbar">
            <input
              className="browse-search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSearch();
              }}
              placeholder='Search cards (e.g. mitosis deck:"Bio" is:due tag:exam)'
            />
            <button type="button" className="btn" onClick={commitSearch} disabled={liveSearch}>
              Search
            </button>
            <label className="browse-live">
              <input
                type="checkbox"
                checked={liveSearch}
                onChange={(e) => toggleLive(e.target.checked)}
              />
              Live
            </label>
            <label className="browse-live">
              <input
                type="checkbox"
                checked={includeSubfolders}
                onChange={(e) => setIncludeSubfolders(e.target.checked)}
              />
              Subfolders
            </label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by">
              <option value="FRONT">Question</option>
              <option value="BACK">Answer</option>
              <option value="FOLDER">Folder</option>
              <option value="DUE">Due</option>
              <option value="EASE">Ease</option>
              <option value="INTERVAL">Interval</option>
              <option value="CREATED">Created</option>
            </select>
            <button
              type="button"
              className="btn"
              onClick={() => setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"))}
            >
              {sortDir === "ASC" ? "↑" : "↓"}
            </button>
            <span className="muted">{total} cards</span>
          </div>

          {selected.size > 0 && (
            <div className="browse-bulk">
              <span>{selected.size} selected</span>
              <button type="button" className="btn btn-danger" onClick={bulkDelete}>
                Delete
              </button>
              <button type="button" className="btn" onClick={() => setMoveOpen(true)}>
                Move…
              </button>
              <button type="button" className="btn" onClick={() => bulkSuspend(true)}>
                Suspend
              </button>
              <button type="button" className="btn" onClick={() => bulkSuspend(false)}>
                Unsuspend
              </button>
              <button type="button" className="btn" onClick={() => bulkReset()}>
                Reset
              </button>
              {[1, 2, 3, 4, 5, 6, 7].map((f) => (
                <button key={f} type="button" className="btn browse-flag-btn" onClick={() => bulkFlag(f)}>
                  Flag {f}
                </button>
              ))}
              <input
                placeholder="Save search as…"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                className="browse-save-name"
              />
              <button type="button" className="btn" onClick={saveCurrentSearch}>
                Save
              </button>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          {loading && <p className="muted">Loading…</p>}

          <div className="browse-table-wrap">
            <table className="browse-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th>Question</th>
                  <th>Answer</th>
                  <th>Folder</th>
                  <th>Due</th>
                  <th>Ease</th>
                  <th>Int.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={[
                      selected.has(row.id) ? "is-selected" : "",
                      row.suspended ? "is-suspended" : "",
                    ].join(" ")}
                    style={row.flag ? { borderLeft: `3px solid ${flagColor(row.flag)}` } : undefined}
                    onClick={() => toggleRow(row.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                    <td>{row.frontText.slice(0, 120)}</td>
                    <td>{row.backText.slice(0, 120)}</td>
                    <td title={row.folderPath}>{row.folderTitle}</td>
                    <td>{formatDue(row.dueDate)}</td>
                    <td>{row.easeFactor.toFixed(2)}</td>
                    <td>{row.interval}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        {selectedCard && (
          <section className="browse-editor">
            <h2>Edit card</h2>
            <label>
              Front
              <textarea value={editFront} onChange={(e) => setEditFront(e.target.value)} rows={4} />
            </label>
            <label>
              Back
              <textarea value={editBack} onChange={(e) => setEditBack(e.target.value)} rows={4} />
            </label>
            <button type="button" className="btn" disabled={saving} onClick={saveCardEdits}>
              {saving ? "Saving…" : "Save"}
            </button>
            <div className="browse-preview">
              <CardFace text={editFront} />
              <CardFace text={editBack} />
            </div>
          </section>
        )}
      </div>

      {moveOpen && (
        <div className="browse-modal-backdrop" onClick={() => setMoveOpen(false)}>
          <div className="browse-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Move to folder</h2>
            <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
              <option value="">Choose folder…</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <div className="browse-modal-actions">
              <button type="button" className="btn" onClick={() => setMoveOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={bulkMove}>
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {findOpen && (
        <div className="browse-modal-backdrop" onClick={() => setFindOpen(false)}>
          <div className="browse-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Find / replace</h2>
            <input placeholder="Find" value={findText} onChange={(e) => setFindText(e.target.value)} />
            <input
              placeholder="Replace"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
            />
            <label>
              <input type="checkbox" checked={findRegex} onChange={(e) => setFindRegex(e.target.checked)} />
              Regex
            </label>
            <p className="muted small">
              {selected.size > 0
                ? `Scope: ${selected.size} selected card(s)`
                : "Scope: current folder filter or all folders"}
            </p>
            <div className="browse-modal-actions">
              <button type="button" className="btn" onClick={() => setFindOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={runFindReplace}>
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
