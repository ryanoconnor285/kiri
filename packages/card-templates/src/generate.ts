import { clozeFieldNameFromModel, distinctClozeNumbers } from "./cloze.js";
import { extractTypeInField, renderCardSides, stripHtml } from "./templates.js";
import type {
  CardTemplateDef,
  GeneratedCardSpec,
  NoteModelKind,
  RenderContext,
} from "./types.js";

function fieldMapFromRecord(values: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(values));
}

export function generateCardsFromNote(
  kind: NoteModelKind,
  templates: CardTemplateDef[],
  fieldValues: Record<string, string>,
  ctx: RenderContext = {},
): GeneratedCardSpec[] {
  const fields = fieldMapFromRecord(fieldValues);
  const sortedTemplates = [...templates].sort((a, b) => a.ord - b.ord);
  const specs: GeneratedCardSpec[] = [];

  if (kind === "multiple_choice") {
    const template = sortedTemplates[0] ?? {
      ord: 0,
      name: "Card 1",
      qfmt: "{{Question}}",
      afmt: "{{Explanation}}",
    };
    const { front, back } = renderCardSides(template.qfmt, template.afmt, fields, null, ctx);
    if (!stripHtml(front).trim()) return [];
    specs.push({
      templateOrd: template.ord,
      clozeOrd: -1,
      front,
      back,
      typeInField: null,
    });
    return specs;
  }

  if (kind === "cloze") {
    const clozeField = clozeFieldNameFromModel(kind, fields);
    const text = fields.get(clozeField) ?? "";
    const numbers = distinctClozeNumbers(text);
    const template = sortedTemplates[0] ?? {
      ord: 0,
      name: "Cloze",
      qfmt: "{{cloze:Text}}",
      afmt: "{{cloze:Text}}",
    };
    for (const n of numbers) {
      const clozeOrd = n - 1;
      const { front, back } = renderCardSides(template.qfmt, template.afmt, fields, clozeOrd, ctx);
      if (!stripHtml(front).trim()) continue;
      specs.push({
        templateOrd: template.ord,
        clozeOrd: clozeOrd,
        front,
        back,
        typeInField: extractTypeInField(template.qfmt),
      });
    }
    return specs;
  }

  for (const template of sortedTemplates) {
    const { front, back } = renderCardSides(template.qfmt, template.afmt, fields, null, ctx);
    if (!stripHtml(front).trim()) continue;
    specs.push({
      templateOrd: template.ord,
      clozeOrd: -1,
      front,
      back,
      typeInField: extractTypeInField(template.qfmt),
    });
  }

  return specs;
}

export function cardGenerationKey(templateOrd: number, clozeOrd: number): string {
  return clozeOrd < 0 ? `t${templateOrd}` : `t${templateOrd}c${clozeOrd}`;
}
