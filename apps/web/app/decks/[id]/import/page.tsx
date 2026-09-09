"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { gqlFetch } from "@/lib/graphql";
import { KatexRenderer } from "@/components/KatexRenderer";

type ImportedCard = {
  frontText: string;
  backText: string;
};

export default function ImportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<ImportedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      const data = await gqlFetch<{
        aiImportCards: { cards: ImportedCard[]; normalizedCount: number };
      }>(
        `mutation($rawText: String!) {
          aiImportCards(rawText: $rawText) {
            normalizedCount
            cards { frontText backText }
          }
        }`,
        { rawText },
      );
      setPreview(data.aiImportCards.cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (preview.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const card of preview) {
        await gqlFetch(
          `mutation($deckId: String!, $frontText: String!, $backText: String!) {
            upsertCard(deckId: $deckId, frontText: $frontText, backText: $backText) {
              id
            }
          }`,
          {
            deckId: params.id,
            frontText: card.frontText,
            backText: card.backText,
          },
        );
      }
      router.push(`/decks/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <Link href={`/decks/${params.id}`} className="muted">
            ← Back to deck
          </Link>
          <h1 style={{ marginTop: "0.5rem" }}>Import Cards</h1>
          <p className="muted">
            Paste lecture notes or Q/A pairs (use blank lines or | to separate front/back)
          </p>
        </div>
      </header>

      <div className="stack">
        <textarea
          className="input textarea"
          placeholder={`H2SO4\nSulfuric acid\n\nE = mc^2\nMass-energy equivalence`}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />

        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

        <div className="row">
          <button
            className="btn btn-primary"
            onClick={handlePreview}
            disabled={loading || !rawText.trim()}
          >
            {loading ? "Processing..." : "Preview import"}
          </button>
          {preview.length > 0 && (
            <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : `Save ${preview.length} cards`}
            </button>
          )}
        </div>

        {preview.length > 0 && (
          <div className="grid">
            {preview.map((card, index) => (
              <div key={index} className="card">
                <p className="flashcard-label">Front</p>
                <KatexRenderer text={card.frontText} block />
                <p className="flashcard-label" style={{ marginTop: "1rem" }}>
                  Back
                </p>
                <KatexRenderer text={card.backText} block />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
