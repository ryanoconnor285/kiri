"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CardFace } from "@/components/CardFace";
import { FitCardBody } from "@/components/FitCardBody";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";
import {
  applyRecall,
  EMPTY_RECALL_META,
  leaveQuality,
  type RecallMeta,
  type RecallRating,
} from "@/lib/recall-queue";

type RecallCard = {
  cardId: string;
  card: {
    id: string;
    frontText: string;
    backText: string;
  };
};

type QueueItem = RecallCard & RecallMeta;

const RECALL_CHOICES = [
  {
    id: "total" as const,
    title: "Total",
    hint: "It came back clean",
  },
  {
    id: "fuzzy" as const,
    title: "Fuzzy",
    hint: "Close — show it again this round",
  },
  {
    id: "zero" as const,
    title: "Zero",
    hint: "Nothing came back — show it again this round",
  },
];

async function submitReview(cardId: string, quality: 0 | 3 | 4) {
  await gqlFetch(
    `mutation($cardId: String!, $quality: Int!) {
      submitReview(cardId: $cardId, quality: $quality) { cardId }
    }`,
    { cardId, quality },
  );
}

export default function RecallPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [sessionTotal, setSessionTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
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
    setQueue(data.dueCards.map((card) => ({ ...card, ...EMPTY_RECALL_META })));
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

  async function markRecall(rating: RecallRating) {
    if (!current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const step = applyRecall(current, rating);
      if (step.submit !== null) {
        await submitReview(current.cardId, step.submit);
      }
      setQueue((prev) => {
        const rest = prev.slice(1);
        if (step.done) return rest;
        return [...rest, { ...current, ...step.meta }];
      });
      if (step.done) {
        setDoneCount((n) => n + 1);
      }
      setRevealed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that check");
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveRound() {
    if (leaving) return;
    setLeaving(true);
    try {
      for (const item of queueRef.current) {
        const quality = leaveQuality(item);
        if (quality !== null) {
          await submitReview(item.cardId, quality);
        }
      }
    } catch {
      // Still leave the round if a flush fails.
    }
    router.push(`/decks/${params.id}`);
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

  const faceText = revealed ? current.card.backText : current.card.frontText;

  return (
    <div className="study-shell">
      <header className="study-top">
        <button type="button" className="btn btn-secondary study-close" onClick={leaveRound} disabled={leaving}>
          Leave
        </button>
        <p className="muted study-progress">
          {doneCount + 1} of {sessionTotal} this round
          {remaining !== sessionTotal - doneCount ? ` · ${remaining} still in hopper` : ""}
        </p>
      </header>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="study-stage">
        <button
          type="button"
          className="card flashcard study-card"
          onClick={() => setRevealed(true)}
          disabled={revealed}
        >
          <p className="flashcard-label">{revealed ? "Answer" : "Prompt"}</p>
          <FitCardBody contentKey={`${current.cardId}:${revealed ? "a" : "p"}:${faceText}`}>
            <CardFace text={faceText} />
          </FitCardBody>
          {!revealed && <p className="flashcard-hint">Check your recall — tap to uncover</p>}
        </button>
      </div>

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
                onClick={() => markRecall(choice.id)}
              >
                <span className="recall-choice-title">{choice.title}</span>
                <span className="recall-choice-hint">{choice.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
