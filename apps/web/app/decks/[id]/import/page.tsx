"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { stubAiImport } from "@kiri/schema";
import { CardFace } from "@/components/CardFace";
import { gqlFetch } from "@/lib/graphql";
import { uploadApkg } from "@/lib/import-apkg";
import { KIRI_IMPORT_PROMPT } from "@/lib/import-prompt";

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
            <strong>Kiri does not generate cards.</strong> It only splits the format below.
            Use ChatGPT, Claude, or similar to turn notes into that format, then paste here.
          </p>
          <ol className="import-steps muted">
            <li>Copy your lecture notes or a messy Q/A dump.</li>
            <li>Paste them into another AI with the Kiri prompt (Copy prompt).</li>
            <li>Paste the AI’s output into the box.</li>
            <li>Preview, then save.</li>
          </ol>
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={copyPrompt}>
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <p className="muted">Format:</p>
          <ul className="import-rules muted">
            <li>One card = front on the first line, back on the following line(s).</li>
            <li>Separate cards with a blank line.</li>
            <li>
              Or one card per line: <code>Front | Back</code>
            </li>
          </ul>
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
              <div key={index} className="card flashcard">
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
