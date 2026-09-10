"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";
import { CardFace } from "@/components/CardFace";

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
};

const DECKS_QUERY = `query { decks { id parentId title description cardCount } }`;

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

  const refetch = useCallback(async () => {
    const [decksData, cardsData] = await Promise.all([
      gqlFetch<{ decks: Deck[] }>(DECKS_QUERY),
      gqlFetch<{ cards: Card[] }>(
        `query($deckId: String!) { cards(deckId: $deckId) { id frontText backText createdAt } }`,
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
  }, [session, isPending, router, refetch]);

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
        <Link href={`/decks/${deck.id}/import`} className="btn btn-primary">
          Import cards
        </Link>
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
                <p className="muted">{child.cardCount ?? 0} cards</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Cards</h2>
        <div className="grid">
          {cards.map((card) => {
            const showBack = flipped[card.id];
            return (
              <button
                key={card.id}
                type="button"
                className="card flashcard"
                onClick={() => toggleFlip(card.id)}
                style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
              >
                <p className="flashcard-label">{showBack ? "Back" : "Front"}</p>
                <CardFace text={showBack ? card.backText : card.frontText} block />
                <p className="muted" style={{ marginTop: "0.75rem" }}>
                  Tap to flip
                </p>
              </button>
            );
          })}
          {cards.length === 0 && <p className="muted">No cards in this deck yet.</p>}
        </div>
      </section>
    </div>
  );
}
