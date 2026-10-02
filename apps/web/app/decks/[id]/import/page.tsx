"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  formatMcImportPreviewBack,
  parseMultipleChoiceImport,
  stubAiImport,
} from "@kiri/schema";
import { CardFace } from "@/components/CardFace";
import { gqlFetch } from "@/lib/graphql";
import { uploadApkg } from "@/lib/import-apkg";
import { KIRI_IMPORT_EXAMPLE, KIRI_IMPORT_PROMPT } from "@/lib/import-prompt";

type ImportedCard = {
  frontText: string;
  backText: string;
};

type ImportFormat = "qa" | "multiple_choice";

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
  const [importFormat, setImportFormat] = useState<ImportFormat>("qa");
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
    const mc = parseMultipleChoiceImport(rawText);
    let nextPreview: ImportedCard[] = [];
    if (mc.length > 0) {
      setImportFormat("multiple_choice");
      nextPreview = mc.map((note) => ({
        frontText: note.question,
        backText: formatMcImportPreviewBack(note),
      }));
    } else {
      setImportFormat("qa");
      nextPreview = stubAiImport(rawText).map((card) => ({
        frontText: card.front_text,
        backText: card.back_text,
      }));
    }
    setPreview(nextPreview);
    if (nextPreview.length === 0) {
      setError(
        "No cards found. Use Q/A blocks (blank line between cards), Front | Back, or Multiple choice blocks (Question / Choices / Correct).",
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
      await gqlFetch<{ importPastedText: { importedCount: number; format: string } }>(
        `mutation($deckId: String!, $rawText: String!) {
          importPastedText(deckId: $deckId, rawText: $rawText) {
            importedCount
            format
          }
        }`,
        { deckId: params.id, rawText },
      );
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
            Kiri does not generate cards itself. Copy the prompt below into ChatGPT or Claude,
            add your notes at the bottom, then paste the model&apos;s output here. The AI chooses
            what to test; the prompt only defines the text layout Kiri can import (including
            optional multiple choice).
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
            Format rules (content is up to the AI):
          </p>
          <ul className="import-rules muted">
            <li>
              <strong>Blank line</strong> between each basic card or each multiple-choice note.
            </li>
            <li>
              <strong>Basic:</strong> prompt line, then answer lines — or <code>Term | definition</code>.
            </li>
            <li>
              <strong>Multiple choice:</strong> <code>Question:</code>, <code>Choices:</code> (one per
              line), <code>Correct:</code> (0-based indices), <code>AllowMultiple: yes/no</code>.
            </li>
            <li>
              <strong>Math:</strong> plain English outside <code>$...$</code>; only formulas/symbols
              inside dollars. Full-line equations use <code>$$...$$</code>. Avoid Unicode subscripts.
            </li>
          </ul>
          <p className="muted" style={{ marginBottom: "0.25rem" }}>
            Common paste mistakes:
          </p>
          <ul className="import-rules muted">
            <li>Markdown headings, “Card 1:”, or lists with no blank lines between cards</li>
            <li>Intro/outro text or wrapping the output in a code block</li>
            <li>Entire questions wrapped in <code>$...$</code> (hard to read in Kiri)</li>
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
                {saving
                  ? "Saving..."
                  : importFormat === "multiple_choice"
                    ? `Save ${preview.length} multiple-choice notes`
                    : `Save ${preview.length} cards`}
              </button>
            )}
          </div>
        </section>

        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

        {preview.length > 0 && (
          <div className="grid" ref={previewRef}>
            {preview.map((card, index) => (
              <div key={index} className="card flashcard flashcard-preview">
                <p className="flashcard-label">
                  {importFormat === "multiple_choice" ? "Question" : "Front"}
                </p>
                <CardFace text={card.frontText} />
                <p className="flashcard-label" style={{ marginTop: "1rem" }}>
                  {importFormat === "multiple_choice" ? "Answer key" : "Back"}
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
