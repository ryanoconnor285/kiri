"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CardFace } from "@/components/CardFace";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";

type RecallCard = {
  cardId: string;
  card: {
    id: string;
    frontText: string;
    backText: string;
  };
};

/** Self-check of retrieval, not Anki-style ease grades. */
const RECALL_CHOICES = [
  {
    id: "blank",
    title: "Blank",
    hint: "Nothing came back — keep it in this round",
    quality: 0,
  },
  {
    id: "partial",
    title: "Partial",
    hint: "Fragments only — I could not reconstruct it",
    quality: 3,
  },
  {
    id: "retrieved",
    title: "Retrieved",
    hint: "I reconstructed it from memory",
    quality: 4,
  },
] as const;

export default function RecallPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [queue, setQueue] = useState<RecallCard[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const data = await gqlFetch<{ dueCards: RecallCard[] }>(
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
    setRevealed(false);
  }, [params.id]);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    loadQueue()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load this round"))
      .finally(() => setLoading(false));
  }, [session, isPending, router, loadQueue]);

  const current = queue[0] ?? null;
  const remaining = queue.length;

  async function markRecall(quality: number) {
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
      setRevealed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that check");
    } finally {
      setSubmitting(false);
    }
  }

  if (isPending || loading) {
    return (
      <div className="study-shell">
        <p className="muted">Loading round…</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="study-shell">
        <div className="study-caught-up stack">
          <h1>Round clear</h1>
          <p className="muted">
            {sessionTotal === 0
              ? "Nothing is waiting in this folder or its nested decks."
              : `You checked ${doneCount} card${doneCount === 1 ? "" : "s"} this round.`}
          </p>
          <Link href={`/decks/${params.id}`} className="btn btn-primary">
            Back to folder
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="study-shell">
      <header className="study-top">
        <Link href={`/decks/${params.id}`} className="btn btn-secondary study-close">
          Leave
        </Link>
        <p className="muted study-progress">
          {doneCount + 1} of {sessionTotal} this round
          {remaining !== sessionTotal - doneCount ? ` · ${remaining} still in hopper` : ""}
        </p>
      </header>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <button
        type="button"
        className="card flashcard study-card"
        onClick={() => setRevealed(true)}
        disabled={revealed}
      >
        <p className="flashcard-label">{revealed ? "Answer" : "Prompt"}</p>
        <CardFace text={revealed ? current.card.backText : current.card.frontText} block />
        {!revealed && <p className="flashcard-hint">Check your recall — tap to uncover</p>}
      </button>

      {revealed && (
        <div className="recall-panel">
          <p className="recall-prompt">How did it come back?</p>
          <div className="recall-choices" role="group" aria-label="Recall check">
            {RECALL_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`recall-choice recall-${choice.id}`}
                disabled={submitting}
                onClick={() => markRecall(choice.quality)}
              >
                <span className="recall-choice-title">{choice.title}</span>
                <span className="recall-choice-hint">{choice.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="recall-automatic"
            disabled={submitting}
            onClick={() => markRecall(5)}
          >
            It was automatic — park it longer
          </button>
        </div>
      )}
    </div>
  );
}
