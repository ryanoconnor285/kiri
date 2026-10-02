"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CardFace } from "@/components/CardFace";
import { FitCardBody } from "@/components/FitCardBody";
import { MultipleChoiceStudy } from "@/components/MultipleChoiceStudy";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";
import {
  applyStudy,
  EMPTY_STUDY_META,
  leaveQuality,
  type StudyMeta,
  type StudyRating,
} from "@/lib/recall-queue";

type DueCard = {
  cardId: string;
  card: {
    id: string;
    frontText: string;
    backText: string;
  };
};

type QueueItem = DueCard & StudyMeta;

type CardStudyRender = {
  cardId: string;
  studyMode: string;
  frontHtml: string;
  backHtml: string;
  modelCss: string;
  typeInField: string | null;
  mcChoices: string[] | null;
  mcAllowMultiple: boolean | null;
  mcCorrectIndices: number[] | null;
};

const STUDY_CHOICES = [
  { id: "right" as const, title: "Right", hint: "Got it — next card" },
  { id: "wrong" as const, title: "Wrong", hint: "Back of the deck this session" },
];

const CARD_STUDY_RENDER = `
query($cardId: String!, $revealed: Boolean) {
  cardStudyRender(cardId: $cardId, revealed: $revealed) {
    cardId studyMode frontHtml backHtml modelCss typeInField
    mcChoices mcAllowMultiple mcCorrectIndices
  }
}`;

async function submitReview(cardId: string, quality: 0 | 4) {
  await gqlFetch(
    `mutation($cardId: String!, $quality: Int!) {
      submitReview(cardId: $cardId, quality: $quality) { cardId }
    }`,
    { cardId, quality },
  );
}

export default function StudyPage() {
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
  const [studyRender, setStudyRender] = useState<CardStudyRender | null>(null);
  const [typeInValue, setTypeInValue] = useState("");

  const loadQueue = useCallback(async () => {
    const data = await gqlFetch<{ dueCards: DueCard[] }>(
      `query($deckId: String!) {
        dueCards(deckId: $deckId) {
          cardId
          card { id frontText backText }
        }
      }`,
      { deckId: params.id },
    );
    setQueue(data.dueCards.map((card) => ({ ...card, ...EMPTY_STUDY_META })));
    setSessionTotal(data.dueCards.length);
    setDoneCount(0);
    setRevealed(false);
  }, [params.id]);

  const current = queue[0] ?? null;
  const remaining = queue.length;

  const loadStudyRender = useCallback(
    async (cardId: string, showAnswer: boolean) => {
      const data = await gqlFetch<{ cardStudyRender: CardStudyRender | null }>(CARD_STUDY_RENDER, {
        cardId,
        revealed: showAnswer,
      });
      setStudyRender(data.cardStudyRender);
    },
    [],
  );

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    loadQueue()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load this round"))
      .finally(() => setLoading(false));
  }, [params.id, isPending, session?.user?.id, router, loadQueue]);

  useEffect(() => {
    if (!current) {
      setStudyRender(null);
      return;
    }
    setRevealed(false);
    setTypeInValue("");
    loadStudyRender(current.cardId, false).catch(() => setStudyRender(null));
  }, [current?.cardId, current?.presentations, loadStudyRender]);

  useEffect(() => {
    if (!current || !revealed) return;
    loadStudyRender(current.cardId, true).catch(() => {});
  }, [revealed, current?.cardId, loadStudyRender]);

  async function markStudy(rating: StudyRating) {
    if (!current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const step = applyStudy(current, rating);
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
      setError(err instanceof Error ? err.message : "Could not save that answer");
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
              : `You studied ${doneCount} card${doneCount === 1 ? "" : "s"} this round.`}
          </p>
          <Link href={`/decks/${params.id}`} className="btn btn-primary">
            Back to folder
          </Link>
        </div>
      </div>
    );
  }

  const mode = studyRender?.studyMode ?? "STANDARD";
  const isMc = mode === "MULTIPLE_CHOICE" && studyRender?.mcChoices?.length;
  const isTypeIn = mode === "TYPE_IN" && studyRender?.typeInField;

  const faceText = revealed ? current.card.backText : current.card.frontText;

  return (
    <div className="study-shell">
      <header className="study-top">
        <button
          type="button"
          className="btn btn-secondary study-close"
          onClick={leaveRound}
          disabled={leaving}
        >
          Leave
        </button>
        <p className="muted study-progress">
          {doneCount + 1} of {sessionTotal} this round
          {remaining !== sessionTotal - doneCount ? ` · ${remaining} still in deck` : ""}
        </p>
      </header>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="study-stage">
        {isMc ? (
          <MultipleChoiceStudy
            questionHtml={studyRender!.frontHtml}
            choices={studyRender!.mcChoices!}
            allowMultiple={studyRender!.mcAllowMultiple ?? false}
            correctIndices={studyRender!.mcCorrectIndices}
            explanationHtml={studyRender!.backHtml}
            modelCss={studyRender!.modelCss}
            shuffleSeed={current.presentations}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        ) : (
          <button
            type="button"
            className="card flashcard study-card"
            onClick={() => !isTypeIn && setRevealed(true)}
            disabled={revealed && !isTypeIn}
          >
            {studyRender?.modelCss ? <style>{studyRender.modelCss}</style> : null}
            <p className="flashcard-label">{revealed ? "Answer" : "Prompt"}</p>
            <FitCardBody contentKey={`${current.cardId}:${revealed ? "a" : "p"}:${faceText}`}>
              {isTypeIn && !revealed ? (
                <div className="stack">
                  <CardFace text={studyRender!.frontHtml.replace(/<input[^>]*>/gi, "")} />
                  <input
                    className="input kiri-type-in-input"
                    value={typeInValue}
                    onChange={(e) => setTypeInValue(e.target.value)}
                    placeholder="Type your answer"
                    autoComplete="off"
                  />
                </div>
              ) : (
                <CardFace text={faceText} />
              )}
            </FitCardBody>
            {!revealed && !isTypeIn && (
              <p className="flashcard-hint">Tap to reveal the answer</p>
            )}
            {isTypeIn && !revealed && (
              <p className="flashcard-hint">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealed(true);
                  }}
                >
                  Check
                </button>
              </p>
            )}
          </button>
        )}
      </div>

      {(revealed || (isMc && revealed)) && (
        <div className="study-answer-panel">
          <p className="study-answer-prompt">How did you do?</p>
          <div className="study-answer-choices" role="group" aria-label="Study check">
            {STUDY_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`study-answer-choice study-${choice.id}`}
                disabled={submitting}
                onClick={() => markStudy(choice.id)}
              >
                <span className="study-answer-choice-title">{choice.title}</span>
                <span className="study-answer-choice-hint">{choice.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
