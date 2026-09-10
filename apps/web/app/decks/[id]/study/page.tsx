"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CardFace } from "@/components/CardFace";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";

type StudyCard = {
  cardId: string;
  card: {
    id: string;
    frontText: string;
    backText: string;
  };
};

const RATINGS = [
  { label: "Again", quality: 0, className: "rating-again" },
  { label: "Hard", quality: 3, className: "rating-hard" },
  { label: "Good", quality: 4, className: "rating-good" },
  { label: "Easy", quality: 5, className: "rating-easy" },
] as const;

export default function StudyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [queue, setQueue] = useState<StudyCard[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [showingBack, setShowingBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const data = await gqlFetch<{ dueCards: StudyCard[] }>(
      `query($deckId: String!) {
        dueCards(deckId: $deckId) {
          cardId
          card { id frontText backText }
        }
      }`,
      { deckId: params.id },
    );
    setQueue(data.dueCards);
    setSessionTotal(data.dueCards.length);
    setDoneCount(0);
    setShowingBack(false);
  }, [params.id]);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    loadQueue()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load due cards"))
      .finally(() => setLoading(false));
  }, [session, isPending, router, loadQueue]);

  const current = queue[0] ?? null;
  const remaining = queue.length;

  async function rate(quality: number) {
    if (!current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await gqlFetch(
        `mutation($cardId: String!, $quality: Int!) {
          submitReview(cardId: $cardId, quality: $quality) { cardId }
        }`,
        { cardId: current.cardId, quality },
      );
      setQueue((prev) => {
        const rest = prev.slice(1);
        if (quality === 0) {
          return [...rest, current];
        }
        return rest;
      });
      if (quality !== 0) {
        setDoneCount((n) => n + 1);
      }
      setShowingBack(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isPending || loading) {
    return (
      <div className="study-shell">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="study-shell">
        <div className="study-caught-up stack">
          <h1>You’re caught up</h1>
          <p className="muted">
            {sessionTotal === 0
              ? "Nothing is due in this deck or its subfolders."
              : `Reviewed ${doneCount} card${doneCount === 1 ? "" : "s"} this session.`}
          </p>
          <Link href={`/decks/${params.id}`} className="btn btn-primary">
            Back to deck
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="study-shell">
      <header className="study-top">
        <Link href={`/decks/${params.id}`} className="btn btn-secondary study-close">
          Close
        </Link>
        <p className="muted study-progress">
          {doneCount + 1} / {sessionTotal} due
          {remaining !== sessionTotal - doneCount ? ` · ${remaining} left` : ""}
        </p>
      </header>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <button
        type="button"
        className="card flashcard study-card"
        onClick={() => setShowingBack(true)}
        disabled={showingBack}
      >
        <p className="flashcard-label">{showingBack ? "Back" : "Front"}</p>
        <CardFace text={showingBack ? current.card.backText : current.card.frontText} block />
        {!showingBack && <p className="flashcard-hint">Tap to show answer</p>}
      </button>

      {showingBack && (
        <div className="rating-bar" role="group" aria-label="Rate this card">
          {RATINGS.map((rating) => (
            <button
              key={rating.label}
              type="button"
              className={`btn ${rating.className}`}
              disabled={submitting}
              onClick={() => rate(rating.quality)}
            >
              {rating.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
