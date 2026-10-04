"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { parenthesesToBlanks } from "@kiri/card-templates";
import { gqlFetch } from "@/lib/graphql";

type NoteModel = {
  id: string;
  name: string;
  kind: string;
  fields: { name: string; ord: number }[];
};

export default function AddCollectionNotePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [models, setModels] = useState<NoteModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = models.find((m) => m.id === modelId);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    gqlFetch<{ noteModels: NoteModel[] }>(
      `query { noteModels { id name kind fields { name ord } } }`,
    ).then((d) => {
      setModels(d.noteModels);
      const basic = d.noteModels.find((m) => m.name === "Basic") ?? d.noteModels[0];
      if (basic) {
        setModelId(basic.id);
        const init: Record<string, string> = {};
        for (const f of basic.fields) init[f.name] = "";
        setValues(init);
      }
    });
  }, [session, isPending, router]);

  useEffect(() => {
    if (!selected) return;
    setValues((prev) => {
      const next: Record<string, string> = {};
      for (const f of selected.fields) {
        next[f.name] = prev[f.name] ?? "";
      }
      return next;
    });
  }, [modelId, selected]);

  async function save() {
    if (!modelId) return;
    setSaving(true);
    setError(null);
    try {
      await gqlFetch(
        `mutation($modelId: String!, $deckId: String!, $fieldValuesJson: String!) {
          upsertCollectionNote(modelId: $modelId, deckId: $deckId, fieldValuesJson: $fieldValuesJson) { id }
        }`,
        {
          modelId,
          deckId: params.id,
          fieldValuesJson: JSON.stringify(values),
        },
      );
      router.push(`/decks/${params.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container" style={{ padding: "1rem", maxWidth: 640 }}>
      <Link href={`/decks/${params.id}`}>← Folder</Link>
      <h1 style={{ margin: "1rem 0" }}>Add note</h1>
      <label>
        Note type
        <select
          className="browse-search"
          style={{ width: "100%", marginTop: 4 }}
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {selected?.kind === "multiple_choice" && (
        <p className="muted small" style={{ marginTop: "0.5rem" }}>
          Choices: one option per line. Correct: comma-separated indices (0-based). AllowMultiple: yes/no.
        </p>
      )}
      {(selected?.kind === "cloze" || selected?.kind === "basic") && (
        <p className="muted small" style={{ marginTop: "0.5rem" }}>
          Hide words with <code>[[increases]]</code>. Example:{" "}
          <code>Y [[increases]] as X [[decreases]]</code>. The card is the prompt with words
          covered — Back is optional. On Cloze, each blank becomes its own card.{" "}
          <code>(increases)</code> can be converted with Block parentheses.
        </p>
      )}
      {selected?.fields.map((f) => (
        <label key={f.name} style={{ display: "block", marginTop: "0.75rem" }}>
          {f.name}
          {f.name === "Choices" || f.name === "Explanation" ? (
            <textarea
              className="browse-search"
              style={{ width: "100%", minHeight: f.name === "Choices" ? 120 : 60 }}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          ) : f.name === "Text" || f.name === "Front" ? (
            <>
              <textarea
                className="browse-search"
                style={{ width: "100%", minHeight: 80 }}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 6 }}
                onClick={() =>
                  setValues((v) => ({ ...v, [f.name]: parenthesesToBlanks(v[f.name] ?? "") }))
                }
              >
                Block parentheses
              </button>
            </>
          ) : (
            <input
              className="browse-search"
              style={{ width: "100%" }}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          )}
        </label>
      ))}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: "1rem" }}
        disabled={saving}
        onClick={save}
      >
        {saving ? "Saving…" : "Save & generate cards"}
      </button>
    </div>
  );
}
