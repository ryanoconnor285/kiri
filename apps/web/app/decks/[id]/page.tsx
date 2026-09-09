"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";
import { KatexRenderer } from "@/components/KatexRenderer";

type Card = {
  id: string;
  frontText: string;
  backText: string;
  createdAt: string;
};

type Deck = {
  id: string;
  title: string;
  description: string | null;
};

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }

    Promise.all([
      gqlFetch<{ deck: Deck | null }>(
        `query($id: String!) { deck(id: $id) { id title description } }`,
        { id: params.id },
      ),
      gqlFetch<{ cards: Card[] }>(
        `query($deckId: String!) { cards(deckId: $deckId) { id frontText backText createdAt } }`,
        { deckId: params.id },
      ),
    ])
      .then(([deckData, cardsData]) => {
        if (!deckData.deck) {
          setError("Deck not found");
          return;
        }
        setDeck(deckData.deck);
        setCards(cardsData.cards);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, isPending, router, params.id]);

  function toggleFlip(cardId: string) {
    setFlipped((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
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
          <Link href="/decks" className="muted">
            ← Decks
          </Link>
          <h1 style={{ marginTop: "0.5rem" }}>{deck.title}</h1>
          {deck.description && <p className="muted">{deck.description}</p>}
        </div>
        <Link href={`/decks/${deck.id}/import`} className="btn btn-primary">
          Import cards
        </Link>
      </header>

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
              <KatexRenderer text={showBack ? card.backText : card.frontText} block />
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                Tap to flip
              </p>
            </button>
          );
        })}
        {cards.length === 0 && (
          <p className="muted">No cards in this deck yet.</p>
        )}
      </div>
    </div>
  );
}
