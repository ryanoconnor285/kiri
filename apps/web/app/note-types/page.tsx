"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { gqlFetch } from "@/lib/graphql";

type NoteModel = {
  id: string;
  name: string;
  kind: string;
  css: string;
  builtinSlug: string | null;
  fields: { name: string; ord: number }[];
  templates: { ord: number; name: string; qfmt: string; afmt: string }[];
};

const QUERY = `query {
  noteModels {
    id name kind css builtinSlug
    fields { name ord }
    templates { ord name qfmt afmt }
  }
}`;

export default function NoteTypesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [models, setModels] = useState<NoteModel[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    gqlFetch<{ noteModels: NoteModel[] }>(QUERY)
      .then((d) => setModels(d.noteModels))
      .catch((e) => setError(e.message));
  }, [session, isPending, router]);

  async function cloneModel(id: string) {
    await gqlFetch(`mutation($id: String!) { cloneNoteModel(id: $id) { id } }`, { id });
    const data = await gqlFetch<{ noteModels: NoteModel[] }>(QUERY);
    setModels(data.noteModels);
  }

  return (
    <div className="container" style={{ padding: "1rem" }}>
      <header className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Note types</h1>
        <Link href="/decks" className="btn btn-secondary">
          Folders
        </Link>
      </header>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <p className="muted">
        Built-in and custom Anki-style note types. Clone a type to customize fields and card templates.
      </p>
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {models.map((model) => (
          <li key={model.id} className="card" style={{ padding: "1rem" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{model.name}</strong>
                <span className="muted" style={{ marginLeft: "0.5rem" }}>
                  {model.kind}
                </span>
              </div>
              <div className="row" style={{ gap: "0.35rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setExpanded(expanded === model.id ? null : model.id)}
                >
                  {expanded === model.id ? "Hide" : "Templates"}
                </button>
                <button type="button" className="btn" onClick={() => cloneModel(model.id)}>
                  Clone
                </button>
              </div>
            </div>
            {expanded === model.id && (
              <div style={{ marginTop: "0.75rem" }}>
                <p className="muted small">
                  Fields: {model.fields.map((f) => f.name).join(", ")}
                </p>
                {model.templates.map((t) => (
                  <details key={t.ord} style={{ marginTop: "0.5rem" }}>
                    <summary>
                      {t.name} (ord {t.ord})
                    </summary>
                    <pre style={{ fontSize: "0.75rem", overflow: "auto" }}>{t.qfmt}</pre>
                    <pre style={{ fontSize: "0.75rem", overflow: "auto" }}>{t.afmt}</pre>
                  </details>
                ))}
                <textarea
                  className="browse-search"
                  style={{ width: "100%", minHeight: 80, marginTop: "0.5rem" }}
                  defaultValue={model.css}
                  onBlur={async (e) => {
                    await gqlFetch(
                      `mutation($id: String!, $css: String!) { updateNoteModel(id: $id, css: $css) { id } }`,
                      { id: model.id, css: e.target.value },
                    );
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
