import { z } from "zod";

export const CardPayloadSchema = z.object({
  front_text: z.string(),
  back_text: z.string(),
  front_pencil_data: z.string().optional(),
  back_pencil_data: z.string().optional(),
});

export type CardPayload = z.infer<typeof CardPayloadSchema>;

export const AiImportInputSchema = z.object({
  raw_text: z.string().min(1),
  deck_title: z.string().optional(),
});

export type AiImportInput = z.infer<typeof AiImportInputSchema>;

export const AiImportOutputSchema = z.object({
  cards: z.array(CardPayloadSchema),
  normalized_count: z.number().int().nonnegative(),
});

export type AiImportOutput = z.infer<typeof AiImportOutputSchema>;

export const UpsertCardInputSchema = CardPayloadSchema.extend({
  id: z.string().uuid().optional(),
  deck_id: z.string().uuid(),
});

export type UpsertCardInput = z.infer<typeof UpsertCardInputSchema>;

export const ReviewQualitySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export type ReviewQuality = z.infer<typeof ReviewQualitySchema>;

/** Stub: convert plain chemical formulas to basic KaTeX */
export function normalizeScientificText(text: string): string {
  return text
    .replace(/([A-Z][a-z]?)(\d+)/g, (_match, element: string, sub: string) => {
      return `\\text{${element}}_{${sub}}`;
    })
    .replace(/\^(\d+)/g, "^{$1}")
    .replace(/_\(([^)]+)\)/g, "_{$1}");
}

const FIELD_LABEL =
  /^(?:q(?:uestion)?|a(?:nswer)?|front|back|prompt)\s*[:.\-–—]\s*/i;

function stripFieldLabel(line: string): string {
  return line.replace(FIELD_LABEL, "").trim();
}

function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim();
}

function splitInlinePair(line: string): [string, string] | null {
  for (const sep of [" | ", "|", " — ", " – "]) {
    const index = line.indexOf(sep);
    if (index <= 0) continue;
    const front = stripFieldLabel(line.slice(0, index));
    const back = stripFieldLabel(line.slice(index + sep.length));
    if (front && back) return [front, back];
  }
  return null;
}

function pushCard(cards: CardPayload[], front: string, back: string) {
  const frontText = normalizeScientificText(front.trim());
  const backText = normalizeScientificText(back.trim());
  if (!frontText || !backText) return;
  cards.push({ front_text: frontText, back_text: backText });
}

/** Split pasted Q/A text into cards (blank lines, labels, or Front | Back). */
export function stubAiImport(rawText: string): CardPayload[] {
  const blocks = rawText
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const cards: CardPayload[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => stripListMarker(line.trim()))
      .filter(Boolean);
    if (lines.length === 0) continue;

    const labeledFront = lines.find((line) =>
      /^(?:front|q(?:uestion)?|prompt)\s*[:.\-–—]/i.test(line),
    );
    const labeledBack = lines.find((line) => /^(?:back|a(?:nswer)?)\s*[:.\-–—]/i.test(line));
    if (labeledFront && labeledBack) {
      pushCard(cards, stripFieldLabel(labeledFront), stripFieldLabel(labeledBack));
      continue;
    }

    const inlinePairs = lines.map(splitInlinePair);
    if (inlinePairs.every((pair) => pair !== null)) {
      for (const pair of inlinePairs) {
        pushCard(cards, pair![0], pair![1]);
      }
      continue;
    }

    if (lines.length >= 2) {
      pushCard(
        cards,
        stripFieldLabel(lines[0]!),
        lines.slice(1).map(stripFieldLabel).join("\n"),
      );
      continue;
    }

    const inline = splitInlinePair(lines[0]!);
    if (inline) {
      pushCard(cards, inline[0], inline[1]);
    }
  }

  return cards;
}
