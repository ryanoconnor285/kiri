"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CardFace } from "@/components/CardFace";
import { API_URL } from "@/lib/config";
import { gqlFetch } from "@/lib/graphql";

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
  const [apkgName, setApkgName] = useState<string | null>(null);
  const [apkgImporting, setApkgImporting] = useState(false);
  const [apkgResult, setApkgResult] = useState<string | null>(null);
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

  async function handleApkg(file: File | undefined) {
    if (!file) return;
    setApkgName(file.name);
    setApkgResult(null);
    setError(null);
    if (!/\.apkg$/i.test(file.name)) {
      setError("Please choose an Anki package ending in .apkg");
      return;
    }
    setApkgImporting(true);
    try {
      const response = await fetch(
        `${API_URL}/api/import/apkg?deckId=${encodeURIComponent(params.id)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        },
      );
      const json = (await response.json()) as {
        importedCount?: number;
        skippedCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "Anki import failed");
      }
      const skipped =
        json.skippedCount && json.skippedCount > 0
          ? ` (${json.skippedCount} skipped)`
          : "";
      setApkgResult(`Imported ${json.importedCount ?? 0} cards${skipped}.`);
      router.push(`/decks/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anki import failed");
    } finally {
      setApkgImporting(false);
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
            Upload an Anki <code>.apkg</code> package, or paste text Q/A pairs
          </p>
        </div>
      </header>

      <div className="stack">
        <section className="card stack">
          <h2 style={{ fontSize: "1rem" }}>From Anki (.apkg)</h2>
          <p className="muted">
            Export a deck from Anki as a <strong>.apkg</strong> package, then choose that file.
            Images in the package are imported; audio and scheduling are not.
          </p>
          <input
            className="input"
            type="file"
            accept=".apkg,application/octet-stream"
            disabled={apkgImporting}
            onChange={(e) => handleApkg(e.target.files?.[0])}
          />
          {apkgName && (
            <p className="muted">
              {apkgImporting ? `Importing ${apkgName}…` : apkgResult ?? apkgName}
            </p>
          )}
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: "1rem" }}>From text</h2>
          <p className="muted">Paste lecture notes or Q/A pairs (blank lines or | to separate front/back)</p>
          <textarea
            className="input textarea"
            placeholder={`H2SO4\nSulfuric acid\n\nE = mc^2\nMass-energy equivalence`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
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
        </section>

        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

        {preview.length > 0 && (
          <div className="grid">
            {preview.map((card, index) => (
              <div key={index} className="card">
                <p className="flashcard-label">Front</p>
                <CardFace text={card.frontText} block />
                <p className="flashcard-label" style={{ marginTop: "1rem" }}>
                  Back
                </p>
                <CardFace text={card.backText} block />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
