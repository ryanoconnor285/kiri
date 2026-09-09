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

/** Stub AI import: split on blank lines and normalize text */
export function stubAiImport(rawText: string): CardPayload[] {
  const blocks = rawText
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const cards: CardPayload[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim());
    if (lines.length >= 2) {
      cards.push({
        front_text: normalizeScientificText(lines[0]!),
        back_text: normalizeScientificText(lines.slice(1).join("\n")),
      });
    } else if (lines.length === 1) {
      const parts = lines[0]!.split("|").map((p) => p.trim());
      if (parts.length >= 2) {
        cards.push({
          front_text: normalizeScientificText(parts[0]!),
          back_text: normalizeScientificText(parts.slice(1).join(" | ")),
        });
      }
    }
  }

  return cards;
}
