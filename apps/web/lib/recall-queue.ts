export type RecallRating = "total" | "fuzzy" | "zero";

export const MAX_LOOKS = 3;

export type RecallMeta = {
  looks: number;
  zeroSubmitted: boolean;
  pendingFuzzy: boolean;
};

export const EMPTY_RECALL_META: RecallMeta = {
  looks: 0,
  zeroSubmitted: false,
  pendingFuzzy: false,
};

export type RecallStep = {
  submit: 0 | 3 | 4 | null;
  done: boolean;
  meta: RecallMeta;
};

/** Hopper + one SM-2 write when the card leaves (or Zero miss, once). */
export function applyRecall(meta: RecallMeta, rating: RecallRating): RecallStep {
  if (rating === "total") {
    return { submit: 4, done: true, meta };
  }

  const looks = meta.looks + 1;
  const capped = looks >= MAX_LOOKS;

  if (rating === "zero") {
    return {
      submit: meta.zeroSubmitted ? null : 0,
      done: capped,
      meta: { looks, zeroSubmitted: true, pendingFuzzy: false },
    };
  }

  if (capped) {
    return {
      submit: meta.zeroSubmitted ? null : 3,
      done: true,
      meta: { looks, zeroSubmitted: meta.zeroSubmitted, pendingFuzzy: true },
    };
  }

  return {
    submit: null,
    done: false,
    meta: { looks, zeroSubmitted: meta.zeroSubmitted, pendingFuzzy: true },
  };
}

/** Hard (3) only if this round was Fuzzy and never Zero. */
export function leaveQuality(meta: RecallMeta): 3 | null {
  if (meta.pendingFuzzy && !meta.zeroSubmitted) return 3;
  return null;
}
