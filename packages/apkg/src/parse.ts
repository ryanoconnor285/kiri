import JSZip from "jszip";
import { normalizeScientificText } from "@kiri/schema";
import { decodeEntities, looksLikeHtml, sanitizeAnkiHtml } from "./html.js";
import { renderCardSides } from "./templates.js";
import { getSql, queryAll } from "./sql.js";

export type ParsedApkgCard = {
  frontText: string;
  backText: string;
};

export type ParsedApkg = {
  cards: ParsedApkgCard[];
  skippedCount: number;
};

const MAX_INLINE_MEDIA_BYTES = 1_500_000;
const FIELD_SEP = "\x1f";

type AnkiField = { name: string; ord: number };
type AnkiTemplate = { name: string; ord: number; qfmt: string; afmt: string };
type AnkiModel = {
  id: number;
  name: string;
  type: number;
  flds: AnkiField[];
  tmpls: AnkiTemplate[];
};

function mimeForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

async function loadMedia(zip: JSZip): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const mediaFile = zip.file("media");
  if (!mediaFile) return map;

  let mapping: Record<string, string> = {};
  try {
    mapping = JSON.parse(await mediaFile.async("string")) as Record<string, string>;
  } catch {
    return map;
  }

  for (const [entryName, fileName] of Object.entries(mapping)) {
    if (!fileName || !/\.(png|jpe?g|gif|svg|webp)$/i.test(fileName)) continue;
    const file = zip.file(entryName);
    if (!file) continue;
    const bytes = await file.async("uint8array");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_INLINE_MEDIA_BYTES) continue;
    const b64 = Buffer.from(bytes).toString("base64");
    map.set(fileName, `data:${mimeForName(fileName)};base64,${b64}`);
  }
  return map;
}

function inlineMedia(html: string, media: Map<string, string>): string {
  return html.replace(
    /(?:src|data-src)=["']([^"']+)["']/gi,
    (full, src: string) => {
      const base = decodeURIComponent(String(src).split("/").pop() ?? src);
      const dataUri = media.get(base) ?? media.get(src);
      if (!dataUri) return full;
      return full.replace(src, dataUri);
    },
  );
}

function finalizeSide(raw: string, media: Map<string, string>): string {
  const inlined = inlineMedia(sanitizeAnkiHtml(raw), media);
  if (looksLikeHtml(inlined)) {
    return inlined;
  }
  const plain = decodeEntities(inlined).replace(/<[^>]+>/g, "").trim();
  return normalizeScientificText(plain);
}

function parseModels(raw: unknown): Map<number, AnkiModel> {
  const models = new Map<number, AnkiModel>();
  if (typeof raw !== "string" || !raw) return models;
  let parsed: Record<string, AnkiModel>;
  try {
    parsed = JSON.parse(raw) as Record<string, AnkiModel>;
  } catch {
    return models;
  }
  for (const model of Object.values(parsed)) {
    if (!model?.flds || !model.tmpls) continue;
    models.set(Number(model.id), model);
  }
  return models;
}

export async function parseApkg(input: Uint8Array | ArrayBuffer | Buffer): Promise<ParsedApkg> {
  const bytes = input instanceof Buffer ? new Uint8Array(input) : new Uint8Array(input);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("Not a valid Anki package (.apkg is a zip file)");
  }

  const collection =
    zip.file("collection.anki21") ??
    zip.file("collection.anki2") ??
    zip.file("collection.anki21b");

  if (!collection) {
    throw new Error("This file is not a recognizable Anki package (missing collection database)");
  }
  if (collection.name.endsWith(".anki21b")) {
    throw new Error(
      "This Anki package uses a newer Anki 23+ format. Re-export it from Anki, or export Notes in plain text and paste them instead.",
    );
  }

  const dbBytes = await collection.async("uint8array");
  const SQL = await getSql();
  const db = new SQL.Database(dbBytes);

  try {
    const media = await loadMedia(zip);
    const colRows = queryAll(db, "SELECT models FROM col LIMIT 1");
    const models = parseModels(colRows[0]?.models);

    const notes = queryAll(db, "SELECT id, mid, flds FROM notes");
    const noteById = new Map<number, { mid: number; fields: string[] }>();
    for (const row of notes) {
      const id = Number(row.id);
      const mid = Number(row.mid);
      const fields = String(row.flds ?? "").split(FIELD_SEP);
      noteById.set(id, { mid, fields });
    }

    const cardRows = queryAll(db, "SELECT nid, ord FROM cards ORDER BY id");
    const cards: ParsedApkgCard[] = [];
    let skippedCount = 0;

    for (const row of cardRows) {
      const note = noteById.get(Number(row.nid));
      if (!note) {
        skippedCount += 1;
        continue;
      }
      const model = models.get(note.mid);
      const fieldMap = new Map<string, string>();
      if (model) {
        for (const field of model.flds) {
          fieldMap.set(field.name, note.fields[field.ord] ?? "");
        }
      } else {
        fieldMap.set("Front", note.fields[0] ?? "");
        fieldMap.set("Back", note.fields.slice(1).join("\n"));
      }

      const ord = Number(row.ord) || 0;
      const template = model?.tmpls.find((t) => t.ord === ord) ?? model?.tmpls[ord] ?? {
        qfmt: "{{Front}}",
        afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
        name: "Card",
        ord,
      };
      const clozeOrd = model?.type === 1 ? ord : null;
      const rendered = renderCardSides(template.qfmt, template.afmt, fieldMap, clozeOrd);
      const frontText = finalizeSide(rendered.front, media);
      const backText = finalizeSide(rendered.back, media);
      if (!frontText && !backText) {
        skippedCount += 1;
        continue;
      }
      cards.push({ frontText, backText });
    }

    if (cards.length === 0 && notes.length > 0) {
      for (const note of noteById.values()) {
        const frontText = finalizeSide(note.fields[0] ?? "", media);
        const backText = finalizeSide(note.fields.slice(1).join("\n"), media);
        if (!frontText && !backText) {
          skippedCount += 1;
          continue;
        }
        cards.push({ frontText, backText });
      }
    }

    return { cards, skippedCount };
  } finally {
    db.close();
  }
}
