export type NoteModelKind = "basic" | "cloze" | "image_occlusion" | "multiple_choice";

export type CardTemplateDef = {
  ord: number;
  name: string;
  qfmt: string;
  afmt: string;
  deckOverrideId?: string | null;
};

export type ModelFieldDef = {
  name: string;
  ord: number;
  isSort?: boolean;
};

export type RenderContext = {
  tags?: string[];
  deckName?: string;
  noteTypeName?: string;
  templateName?: string;
};

export type GeneratedCardSpec = {
  templateOrd: number;
  /** -1 when not a cloze card */
  clozeOrd: number;
  front: string;
  back: string;
  typeInField?: string | null;
};
