import type { CardTemplateDef, ModelFieldDef, NoteModelKind } from "./types.js";

export type BuiltinNoteModel = {
  slug: string;
  name: string;
  kind: NoteModelKind;
  css: string;
  fields: ModelFieldDef[];
  templates: CardTemplateDef[];
};

const DEFAULT_CSS = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}`;

export const BUILTIN_NOTE_MODELS: BuiltinNoteModel[] = [
  {
    slug: "basic",
    name: "Basic",
    kind: "basic",
    css: DEFAULT_CSS,
    fields: [
      { name: "Front", ord: 0, isSort: true },
      { name: "Back", ord: 1 },
    ],
    templates: [
      {
        ord: 0,
        name: "Card 1",
        qfmt: "{{Front}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
      },
    ],
  },
  {
    slug: "basic-reversed",
    name: "Basic (and reversed card)",
    kind: "basic",
    css: DEFAULT_CSS,
    fields: [
      { name: "Front", ord: 0, isSort: true },
      { name: "Back", ord: 1 },
    ],
    templates: [
      {
        ord: 0,
        name: "Card 1",
        qfmt: "{{Front}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
      },
      {
        ord: 1,
        name: "Card 2",
        qfmt: "{{Back}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}",
      },
    ],
  },
  {
    slug: "basic-optional-reverse",
    name: "Basic (optional reversed card)",
    kind: "basic",
    css: DEFAULT_CSS,
    fields: [
      { name: "Front", ord: 0, isSort: true },
      { name: "Back", ord: 1 },
      { name: "Add Reverse", ord: 2 },
    ],
    templates: [
      {
        ord: 0,
        name: "Card 1",
        qfmt: "{{Front}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
      },
      {
        ord: 1,
        name: "Card 2",
        qfmt: "{{#Add Reverse}}{{Back}}{{/Add Reverse}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}",
      },
    ],
  },
  {
    slug: "basic-type-answer",
    name: "Basic (type in the answer)",
    kind: "basic",
    css: DEFAULT_CSS,
    fields: [
      { name: "Front", ord: 0, isSort: true },
      { name: "Back", ord: 1 },
    ],
    templates: [
      {
        ord: 0,
        name: "Card 1",
        qfmt: "{{Front}}\n\n{{type:Back}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
      },
    ],
  },
  {
    slug: "cloze",
    name: "Cloze",
    kind: "cloze",
    css: DEFAULT_CSS,
    fields: [
      { name: "Text", ord: 0, isSort: true },
      { name: "Back Extra", ord: 1 },
    ],
    templates: [
      {
        ord: 0,
        name: "Cloze",
        qfmt: "{{cloze:Text}}",
        afmt: "{{cloze:Text}}<br>{{Back Extra}}",
      },
    ],
  },
  {
    slug: "multiple-choice",
    name: "Multiple choice",
    kind: "multiple_choice",
    css: `.kiri-mc-option { display: block; width: 100%; text-align: left; margin: 0.35rem 0; padding: 0.65rem 0.75rem; border-radius: 10px; border: 1px solid var(--border, #ccc); }
.kiri-mc-option.is-selected { background: #dbeafe; border-color: #3b82f6; }
.kiri-mc-option.is-correct { background: #dcfce7; border-color: #22c55e; }
.kiri-mc-option.is-incorrect { background: #fee2e2; border-color: #ef4444; opacity: 0.85; }`,
    fields: [
      { name: "Question", ord: 0, isSort: true },
      { name: "Choices", ord: 1 },
      { name: "Correct", ord: 2 },
      { name: "AllowMultiple", ord: 3 },
      { name: "Explanation", ord: 4 },
    ],
    templates: [
      {
        ord: 0,
        name: "Card 1",
        qfmt: "{{Question}}",
        afmt: "{{Explanation}}",
      },
    ],
  },
  {
    slug: "image-occlusion",
    name: "Image Occlusion",
    kind: "image_occlusion",
    css: DEFAULT_CSS,
    fields: [
      { name: "Image", ord: 0 },
      { name: "Masks", ord: 1 },
      { name: "Header", ord: 2 },
      { name: "Back Extra", ord: 3 },
      { name: "Comments", ord: 4 },
    ],
    templates: [
      {
        ord: 0,
        name: "IO Card",
        qfmt: "{{Header}}\n{{Image}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back Extra}}\n{{Comments}}",
      },
    ],
  },
];
