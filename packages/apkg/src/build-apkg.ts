import JSZip from "jszip";
import { getSql } from "./sql.js";

export type TestNote = {
  fields: string[];
  modelId?: number;
};

export type BuildApkgOptions = {
  notes: TestNote[];
  models?: Record<string, unknown>;
  media?: Record<string, Uint8Array>;
  cloze?: boolean;
};

const BASIC_MODEL_ID = 1_600_000_001;
const CLOZE_MODEL_ID = 1_600_000_002;

export function basicModels(): Record<string, unknown> {
  return {
    [BASIC_MODEL_ID]: {
      id: BASIC_MODEL_ID,
      name: "Basic",
      type: 0,
      flds: [
        { name: "Front", ord: 0 },
        { name: "Back", ord: 1 },
      ],
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
        },
      ],
    },
  };
}

export function clozeModels(): Record<string, unknown> {
  return {
    [CLOZE_MODEL_ID]: {
      id: CLOZE_MODEL_ID,
      name: "Cloze",
      type: 1,
      flds: [{ name: "Text", ord: 0 }],
      tmpls: [
        {
          name: "Cloze",
          ord: 0,
          qfmt: "{{cloze:Text}}",
          afmt: "{{cloze:Text}}",
        },
      ],
    },
  };
}

export async function buildApkg(options: BuildApkgOptions): Promise<Buffer> {
  const SQL = await getSql();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE col (
      id integer primary key,
      crt integer not null,
      mod integer not null,
      scm integer not null,
      ver integer not null,
      dty integer not null,
      usn integer not null,
      ls integer not null,
      conf text not null,
      models text not null,
      decks text not null,
      dconf text not null,
      tags text not null
    );
    CREATE TABLE notes (
      id integer primary key,
      guid text not null,
      mid integer not null,
      mod integer not null,
      usn integer not null,
      tags text not null,
      flds text not null,
      sfld integer not null,
      csum integer not null,
      flags integer not null,
      data text not null
    );
    CREATE TABLE cards (
      id integer primary key,
      nid integer not null,
      did integer not null,
      ord integer not null,
      mod integer not null,
      usn integer not null,
      type integer not null,
      queue integer not null,
      due integer not null,
      ivl integer not null,
      factor integer not null,
      reps integer not null,
      lapses integer not null,
      left integer not null,
      odue integer not null,
      odid integer not null,
      flags integer not null,
      data text not null
    );
  `);

  const models = options.models ?? (options.cloze ? clozeModels() : basicModels());
  const defaultMid = options.cloze ? CLOZE_MODEL_ID : BASIC_MODEL_ID;

  db.run(
    `INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'{}',?,?, '{}','{}')`,
    [JSON.stringify(models), JSON.stringify({ "1": { id: 1, name: "Default" } })],
  );

  options.notes.forEach((note, index) => {
    const nid = 1000 + index;
    const mid = note.modelId ?? defaultMid;
    const flds = note.fields.join("\x1f");
    db.run(
      `INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [nid, `guid-${nid}`, mid, 0, 0, "", flds, 0, 0, 0, ""],
    );
    db.run(
      `INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [2000 + index, nid, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ""],
    );
  });

  const zip = new JSZip();
  zip.file("collection.anki2", Buffer.from(db.export()));
  db.close();

  const mediaIndex: Record<string, string> = {};
  if (options.media) {
    Object.entries(options.media).forEach(([name, data], i) => {
      mediaIndex[String(i)] = name;
      zip.file(String(i), data);
    });
  }
  zip.file("media", JSON.stringify(mediaIndex));

  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out;
}

/** 1×1 red PNG used in tests and local demos. */
export const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc00000000300010005fed4ef0000000049454e44ae426082",
  "hex",
);
