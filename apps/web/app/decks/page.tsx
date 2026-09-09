"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";

type Deck = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  cardCount: number;
};

export default function DecksPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }

    gqlFetch<{ decks: Deck[] }>(
      `query { decks { id title description createdAt cardCount } }`,
    )
      .then((data) => setDecks(data.decks))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, isPending, router]);

  async function createDeck() {
    if (!newTitle.trim()) return;
    try {
      const data = await gqlFetch<{ createDeck: Deck }>(
        `mutation($title: String!) {
          createDeck(title: $title) { id title description createdAt cardCount }
        }`,
        { title: newTitle.trim() },
      );
      setDecks((prev) => [...prev, data.createDeck]);
      setNewTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deck");
    }
  }

  if (isPending || loading) {
    return (
      <div className="container">
        <p className="muted">Loading...</p>
      </div>
    );
  }

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
        <h2 style={{ fontSize: "1rem" }}>Create deck</h2>
        <div className="row">
          <input
            className="input"
            placeholder="Deck title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createDeck()}
          />
          <button className="btn btn-primary" onClick={createDeck}>
            Create
          </button>
        </div>
      </div>

      <div className="grid">
        {decks.map((deck) => (
          <Link key={deck.id} href={`/decks/${deck.id}`} className="card">
            <h2>{deck.title}</h2>
            {deck.description && <p className="muted">{deck.description}</p>}
            <p className="muted">{deck.cardCount ?? 0} cards</p>
          </Link>
        ))}
        {decks.length === 0 && (
          <p className="muted">No decks yet. Create one above or run the seed script.</p>
        )}
      </div>
    </div>
  );
}
