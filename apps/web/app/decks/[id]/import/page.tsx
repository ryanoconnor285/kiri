"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { stubAiImport } from "@kiri/schema";
import { CardFace } from "@/components/CardFace";
import { gqlFetch } from "@/lib/graphql";
import { uploadApkg } from "@/lib/import-apkg";
import { KIRI_IMPORT_EXAMPLE, KIRI_IMPORT_PROMPT } from "@/lib/import-prompt";

type ImportedCard = {
  frontText: string;
  backText: string;
};

type ApkgProgress =
  | { phase: "idle" }
  | { phase: "uploading"; percent: number }
  | { phase: "processing" }
  | { phase: "done"; message: string };

export default function ImportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<ImportedCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apkgName, setApkgName] = useState<string | null>(null);
  const [apkgProgress, setApkgProgress] = useState<ApkgProgress>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const apkgBusy = apkgProgress.phase === "uploading" || apkgProgress.phase === "processing";

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(KIRI_IMPORT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the prompt. Select and copy it from the box below.");
    }
  }

  function handlePreview() {
    setError(null);
    const imported = stubAiImport(rawText).map((card) => ({
      frontText: card.front_text,
      backText: card.back_text,
    }));
    setPreview(imported);
    if (imported.length === 0) {
      setError(
        "No cards found. Put the question on the first line and the answer on the next line(s), with a blank line between cards — or use Front | Back on one line.",
      );
      return;
    }
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    setError(null);
    if (!/\.apkg$/i.test(file.name)) {
      setError("Please choose an Anki package ending in .apkg");
      setApkgProgress({ phase: "idle" });
      return;
    }
    setApkgProgress({ phase: "uploading", percent: 0 });
    // Let the empty bar paint before the request starts so a fast upload
    // still shows progress instead of appearing frozen.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    try {
      const result = await uploadApkg(file, params.id, (update) => {
        setApkgProgress(update);
      });
      const skipped =
        result.skippedCount > 0 ? ` (${result.skippedCount} skipped)` : "";
      setApkgProgress({
        phase: "done",
        message: `Imported ${result.importedCount} cards${skipped}.`,
      });
      await new Promise((resolve) => setTimeout(resolve, 700));
      router.push(`/decks/${params.id}`);
    } catch (err) {
      setApkgProgress({ phase: "idle" });
      setError(err instanceof Error ? err.message : "Anki import failed");
    }
  }

  function progressLabel() {
    if (apkgProgress.phase === "uploading") {
      return `Uploading ${apkgName ?? "package"}… ${apkgProgress.percent}%`;
    }
    if (apkgProgress.phase === "processing") {
      return `Importing cards from ${apkgName ?? "package"}…`;
    }
    if (apkgProgress.phase === "done") {
      return apkgProgress.message;
    }
    return null;
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
            disabled={apkgBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              handleApkg(file);
            }}
          />
          {apkgProgress.phase !== "idle" && (
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                apkgProgress.phase === "uploading" ? apkgProgress.percent : undefined
              }
              aria-valuetext={progressLabel() ?? undefined}
              aria-busy={apkgBusy}
            >
              <div className="progress-track">
                <div
                  className={
                    apkgProgress.phase === "processing"
                      ? "progress-fill indeterminate"
                      : "progress-fill"
                  }
                  style={
                    apkgProgress.phase === "uploading"
                      ? { width: `${apkgProgress.percent}%` }
                      : apkgProgress.phase === "done"
                        ? { width: "100%" }
                        : undefined
                  }
                />
              </div>
              <p className="progress-label">{progressLabel()}</p>
            </div>
          )}
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: "1rem" }}>From text</h2>
          <p>
            <strong>Kiri does not generate cards.</strong> It only parses strict Q/A text.
            Paste lecture notes into ChatGPT or Claude with the prompt below, then paste the
            result here and preview before saving.
          </p>
          <ol className="import-steps muted">
            <li>Copy raw notes (lecture slide text, textbook excerpt, messy outline).</li>
            <li>
              Open another AI chat → paste the <strong>Kiri prompt</strong> → paste your notes
              at the bottom where indicated.
            </li>
            <li>Copy only the card output (no code fences or commentary) into the box below.</li>
            <li>
              <strong>Preview import</strong> — fix anything that split wrong before saving.
            </li>
          </ol>
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={copyPrompt}>
              {copied ? "Copied" : "Copy prompt for AI"}
            </button>
          </div>
          <details className="import-prompt-details">
            <summary className="muted">Show full prompt</summary>
            <pre className="import-prompt-preview">{KIRI_IMPORT_PROMPT}</pre>
          </details>
          <p className="muted" style={{ marginBottom: "0.25rem" }}>
            What Kiri accepts (AI output must match):
          </p>
          <ul className="import-rules muted">
            <li>
              <strong>Blank line between every card</strong> — lists without blank lines import
              as one broken card.
            </li>
            <li>
              <strong>Front on line 1, back on following lines</strong> — or{" "}
              <code>Term | definition</code> one card per line.
            </li>
            <li>
              Optional labels: <code>Front: …</code> and <code>Back: …</code> in the same block.
            </li>
            <li>
              Inline math: <code>$\\Delta H &lt; 0$</code> inside a sentence.
            </li>
            <li>
              Standalone equation line: bare <code>S = k\\ln W</code> or{" "}
              <code>$$S = k\\ln W$$</code> (full back/front).
            </li>
            <li>
              One fact per card — ask the AI to split dense notes into many short recall prompts.
            </li>
          </ul>
          <p className="muted" style={{ marginBottom: "0.25rem" }}>
            Common AI mistakes (won’t parse):
          </p>
          <ul className="import-rules muted">
            <li>Markdown headings, “Card 1:”, or numbered lists with no blank lines</li>
            <li>Intro text like “Here are 12 flashcards based on your notes”</li>
            <li>Wrapping the whole output in a ``` code block</li>
          </ul>
          <textarea
            className="input textarea"
            placeholder={KIRI_IMPORT_EXAMPLE}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <div className="row">
            <button
              className="btn btn-primary"
              onClick={handlePreview}
              disabled={!rawText.trim()}
            >
              Preview import
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
          <div className="grid" ref={previewRef}>
            {preview.map((card, index) => (
              <div key={index} className="card flashcard flashcard-preview">
                <p className="flashcard-label">Front</p>
                <CardFace text={card.frontText} />
                <p className="flashcard-label" style={{ marginTop: "1rem" }}>
                  Back
                </p>
                <CardFace text={card.backText} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
