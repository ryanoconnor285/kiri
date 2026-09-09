import type { ReviewQuality } from "@kiri/schema";

export type Sm2Result = {
  interval: number;
  repetitionCount: number;
  easeFactor: number;
  dueDate: Date;
};

/** Basic SM-2 algorithm implementation */
export function calculateSm2(
  quality: ReviewQuality,
  previous: {
    interval: number;
    repetitionCount: number;
    easeFactor: number;
  },
): Sm2Result {
  let { interval, repetitionCount, easeFactor } = previous;

  if (quality < 3) {
    repetitionCount = 0;
    interval = 1;
  } else {
    if (repetitionCount === 0) {
      interval = 1;
    } else if (repetitionCount === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitionCount += 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);

  return { interval, repetitionCount, easeFactor, dueDate };
}

export function qualityFromLabel(label: string): ReviewQuality {
  switch (label.toLowerCase()) {
    case "again":
      return 0;
    case "hard":
      return 3;
    case "good":
      return 4;
    case "easy":
      return 5;
    default:
      return 3;
  }
}
