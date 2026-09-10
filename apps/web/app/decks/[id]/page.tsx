"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";
import { CardFace } from "@/components/CardFace";
import { FitCardBody } from "@/components/FitCardBody";

type Card = {
  id: string;
  frontText: string;
  backText: string;
  createdAt: string;
};

type Deck = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  cardCount: number;
  dueCount: number;
};

const DECKS_QUERY = `query { decks { id parentId title description cardCount dueCount } }`;

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [childTitle, setChildTitle] = useState("");
  const [frontText, setFrontText] = useState("");
  const [backText, setBackText] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [cardFeedback, setCardFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const addCardRef = useRef<HTMLDivElement>(null);
  const frontInputRef = useRef<HTMLTextAreaElement>(null);

  const refetch = useCallback(async () => {
    const [decksData, cardsData] = await Promise.all([
      gqlFetch<{ decks: Deck[] }>(DECKS_QUERY),
      gqlFetch<{ cards: Card[] }>(
        `query($deckId: String!) {
          cards(deckId: $deckId, limit: 500) { id frontText backText createdAt }
        }`,
        { deckId: params.id },
      ),
    ]);
    setDecks(decksData.decks);
    setCards(cardsData.cards);
  }, [params.id]);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    refetch()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session?.user?.id, isPending, router, refetch]);

  const byId = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks]);
  const deck = byId.get(params.id) ?? null;

  // Breadcrumb path from the root down to (but not including) this deck.
  const ancestors = useMemo(() => {
    const path: Deck[] = [];
    let current = deck?.parentId ? byId.get(deck.parentId) : undefined;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      path.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path;
  }, [deck, byId]);

  const children = useMemo(
    () => decks.filter((d) => d.parentId === params.id),
    [decks, params.id],
  );

  function toggleFlip(cardId: string) {
    setFlipped((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }

  async function addSubfolder() {
    const trimmed = childTitle.trim();
    if (!trimmed) return;
    try {
      await gqlFetch(
        `mutation($title: String!, $parentId: String) {
          createDeck(title: $title, parentId: $parentId) { id }
        }`,
        { title: trimmed, parentId: params.id },
      );
      setChildTitle("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subfolder");
    }
  }

  async function addCard() {
    const front = frontText.trim();
    const back = backText.trim();
    if (!front || !back || savingCard) return;
    setSavingCard(true);
    setCardFeedback(null);
    try {
      await gqlFetch(
        `mutation($deckId: String!, $frontText: String!, $backText: String!) {
          upsertCard(deckId: $deckId, frontText: $frontText, backText: $backText) { id }
        }`,
        { deckId: params.id, frontText: front, backText: back },
      );
      setFrontText("");
      setBackText("");
      setCardFeedback({ kind: "ok", text: "Card added — add another below." });
      await refetch();
      frontInputRef.current?.focus();
    } catch (err) {
      setCardFeedback({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to add card",
      });
    } finally {
      setSavingCard(false);
    }
  }

  function scrollToAddCard() {
    addCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    frontInputRef.current?.focus();
  }

  if (isPending || loading) {
    return (
      <div className="container">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="container">
        <p style={{ color: "var(--danger)" }}>{error ?? "Deck not found"}</p>
        <Link href="/decks">Back to decks</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <nav className="muted" style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            <Link href="/decks" className="muted">
              Decks
            </Link>
            {ancestors.map((a) => (
              <span key={a.id}>
                {" / "}
                <Link href={`/decks/${a.id}`} className="muted">
                  {a.title}
                </Link>
              </span>
            ))}
            <span>{" / "}{deck.title}</span>
          </nav>
          <h1 style={{ marginTop: "0.5rem" }}>{deck.title}</h1>
          {deck.description && <p className="muted">{deck.description}</p>}
        </div>
        <div className="header-actions">
          <Link href={`/decks/${deck.id}/study`} className="btn btn-primary">
            Recall{(deck.dueCount ?? 0) > 0 ? ` · ${deck.dueCount} ready` : ""}
          </Link>
          <button type="button" className="btn btn-secondary" onClick={scrollToAddCard}>
            Add card
          </button>
          <Link href={`/decks/${deck.id}/import`} className="btn btn-secondary">
            Import cards
          </Link>
        </div>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Subfolders &amp; decks</h2>
        <div className="row" style={{ gap: "0.5rem", marginBottom: "1rem" }}>
          <input
            className="input"
            placeholder={`New item inside "${deck.title}"`}
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubfolder()}
          />
          <button className="btn btn-primary" onClick={addSubfolder}>
            Add subfolder
          </button>
        </div>
        {children.length === 0 ? (
          <p className="muted">No subfolders yet.</p>
        ) : (
          <div className="grid">
            {children.map((child) => (
              <Link key={child.id} href={`/decks/${child.id}`} className="card">
                <h2 style={{ fontSize: "1rem" }}>📁 {child.title}</h2>
                {child.description && <p className="muted">{child.description}</p>}
                <p className="muted">
                  {child.cardCount ?? 0} cards
                  {(child.dueCount ?? 0) > 0 ? ` · ${child.dueCount} ready` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section ref={addCardRef}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Cards</h2>
        <div className="card stack" style={{ marginBottom: "1rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            Add cards one at a time to <strong>{deck.title}</strong>. KaTeX math is supported
            (e.g. <code>$E = mc^2$</code>).
          </p>
          <div className="stack">
            <label className="stack" style={{ gap: "0.35rem" }}>
              <span className="muted">Front (prompt)</span>
              <textarea
                ref={frontInputRef}
                className="input textarea"
                placeholder="Question or prompt…"
                value={frontText}
                rows={3}
                onChange={(e) => setFrontText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    addCard();
                  }
                }}
              />
            </label>
            <label className="stack" style={{ gap: "0.35rem" }}>
              <span className="muted">Back (answer)</span>
              <textarea
                className="input textarea"
                placeholder="Answer…"
                value={backText}
                rows={3}
                onChange={(e) => setBackText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    addCard();
                  }
                }}
              />
            </label>
          </div>
          {(frontText.trim() || backText.trim()) && (
            <div className="card flashcard flashcard-browse" style={{ cursor: "default" }}>
              <p className="flashcard-label">Preview</p>
              <FitCardBody contentKey={`preview:${frontText}:${backText}`}>
                <CardFace text={frontText.trim() || "(empty front)"} />
              </FitCardBody>
              {backText.trim() && (
                <>
                  <p className="flashcard-label" style={{ marginTop: "0.75rem" }}>
                    Back
                  </p>
                  <FitCardBody contentKey={`preview-back:${backText}`}>
                    <CardFace text={backText} />
                  </FitCardBody>
                </>
              )}
            </div>
          )}
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingCard || !frontText.trim() || !backText.trim()}
              onClick={addCard}
            >
              {savingCard ? "Saving…" : "Add card"}
            </button>
            <span className="muted">⌘/Ctrl + Enter to save</span>
          </div>
          {cardFeedback && (
            <p
              className="muted"
              style={{
                margin: 0,
                color: cardFeedback.kind === "ok" ? "var(--accent)" : "var(--danger)",
              }}
            >
              {cardFeedback.text}
            </p>
          )}
        </div>
        <div className="grid">
          {cards.map((card) => {
            const showBack = flipped[card.id];
            return (
              <button
                key={card.id}
                type="button"
                className="card flashcard flashcard-browse"
                onClick={() => toggleFlip(card.id)}
              >
                <p className="flashcard-label">{showBack ? "Back" : "Front"}</p>
                <FitCardBody contentKey={`${card.id}:${showBack ? "b" : "f"}`}>
                  <CardFace text={showBack ? card.backText : card.frontText} />
                </FitCardBody>
                <p className="flashcard-hint">Tap to flip</p>
              </button>
            );
          })}
          {cards.length === 0 && <p className="muted">No cards in this deck yet.</p>}
        </div>
      </section>
    </div>
  );
}
