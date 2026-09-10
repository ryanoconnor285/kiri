"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";

type Deck = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  cardCount: number;
  dueCount: number;
};

const DECKS_QUERY = `query { decks { id parentId title description createdAt cardCount dueCount } }`;

export default function DecksPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [childTitle, setChildTitle] = useState("");

  const refetch = useCallback(async () => {
    const data = await gqlFetch<{ decks: Deck[] }>(DECKS_QUERY);
    setDecks(data.decks);
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    refetch()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, isPending, router, refetch]);

  // Group decks by parent so we can render the tree.
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Deck[]>();
    for (const deck of decks) {
      const key = deck.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(deck);
      map.set(key, list);
    }
    return map;
  }, [decks]);

  async function createDeck(parentId: string | null, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await gqlFetch(
        `mutation($title: String!, $parentId: String) {
          createDeck(title: $title, parentId: $parentId) { id }
        }`,
        { title: trimmed, parentId },
      );
      if (parentId) setExpanded((prev) => ({ ...prev, [parentId]: true }));
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    }
  }

  const isOpen = (id: string) => expanded[id] !== false;
  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: prev[id] === false }));

  function renderNodes(parentId: string | null, depth: number) {
    const nodes = childrenByParent.get(parentId) ?? [];
    return nodes.map((deck) => {
      const kids = childrenByParent.get(deck.id) ?? [];
      const hasKids = kids.length > 0;
      const open = isOpen(deck.id);
      return (
        <div key={deck.id}>
          <div
            className="tree-row"
            style={{ paddingLeft: `${depth * 1.15 + 0.25}rem` }}
          >
            {hasKids ? (
              <button
                type="button"
                onClick={() => toggle(deck.id)}
                className="btn btn-secondary"
                style={{ padding: "0 0.5rem", minWidth: 44 }}
                aria-label={open ? "Collapse" : "Expand"}
              >
                {open ? "▾" : "▸"}
              </button>
            ) : (
              <span style={{ display: "inline-block", width: "2.75rem", textAlign: "center" }}>
                ·
              </span>
            )}
            <span aria-hidden>{hasKids ? "📁" : "📄"}</span>
            <Link href={`/decks/${deck.id}`} className="tree-title">
              {deck.title}
            </Link>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {deck.cardCount ?? 0} cards
              {hasKids ? ` · ${kids.length} sub` : ""}
            </span>
            {(deck.dueCount ?? 0) > 0 && (
              <span className="due-badge">{deck.dueCount} ready</span>
            )}
            <Link href={`/decks/${deck.id}/study`} className="btn btn-primary">
              Recall
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setAddingChildFor(addingChildFor === deck.id ? null : deck.id);
                setChildTitle("");
              }}
            >
              + Subfolder
            </button>
          </div>

          {addingChildFor === deck.id && (
            <div
              className="row"
              style={{ gap: "0.5rem", padding: "0.5rem 0.25rem", paddingLeft: `${(depth + 1) * 1.5 + 0.25}rem` }}
            >
              <input
                className="input"
                autoFocus
                placeholder={`New item inside "${deck.title}"`}
                value={childTitle}
                onChange={(e) => setChildTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    createDeck(deck.id, childTitle);
                    setAddingChildFor(null);
                    setChildTitle("");
                  }
                  if (e.key === "Escape") setAddingChildFor(null);
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  createDeck(deck.id, childTitle);
                  setAddingChildFor(null);
                  setChildTitle("");
                }}
              >
                Add
              </button>
            </div>
          )}

          {hasKids && open && renderNodes(deck.id, depth + 1)}
        </div>
      );
    });
  }

  if (isPending || loading) {
    return (
      <div className="container">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  const rootCount = childrenByParent.get(null)?.length ?? 0;

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Your Decks</h1>
          <p className="muted">{session?.user?.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => signOut()}>
          Sign out
        </button>
      </header>

      {error && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}

      <div className="card stack" style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem" }}>New top-level folder or deck</h2>
        <div className="row">
          <input
            className="input"
            placeholder='e.g. "Biochemistry"'
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                createDeck(null, newTitle);
                setNewTitle("");
              }
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              createDeck(null, newTitle);
              setNewTitle("");
            }}
          >
            Create
          </button>
        </div>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Use <strong>+ Subfolder</strong> on any item to nest decks, e.g. Biochemistry ▸ Unit 1 ▸ Lecture.
        </p>
      </div>

      <div className="card" style={{ padding: "0.5rem 0.75rem" }}>
        {rootCount === 0 ? (
          <p className="muted" style={{ padding: "0.75rem" }}>
            No decks yet. Create a top-level folder above.
          </p>
        ) : (
          renderNodes(null, 0)
        )}
      </div>
    </div>
  );
}
