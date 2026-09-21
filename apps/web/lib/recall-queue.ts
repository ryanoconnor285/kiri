export type StudyRating = "right" | "wrong";

export type StudyMeta = {
  /** Wrong answers this session (for leave-round SM-2 flush). */
  wrongAttempts: number;
};

export const EMPTY_STUDY_META: StudyMeta = {
  wrongAttempts: 0,
};

export type StudyStep = {
  submit: 0 | 4 | null;
  done: boolean;
  meta: StudyMeta;
};

/** Session hopper: Right parks the card; Wrong sends it to the back of the queue. */
export function applyStudy(meta: StudyMeta, rating: StudyRating): StudyStep {
  if (rating === "right") {
    return { submit: 4, done: true, meta };
  }
  return {
    submit: null,
    done: false,
    meta: { wrongAttempts: meta.wrongAttempts + 1 },
  };
}

/** Failed round: write a miss if the learner marked Wrong but never got Right. */
export function leaveQuality(meta: StudyMeta): 0 | null {
  if (meta.wrongAttempts > 0) return 0;
  return null;
}

/** @deprecated Use StudyRating */
export type RecallRating = StudyRating;
/** @deprecated Use StudyMeta */
export type RecallMeta = StudyMeta;
/** @deprecated Use EMPTY_STUDY_META */
export const EMPTY_RECALL_META = EMPTY_STUDY_META;
/** @deprecated Use StudyStep */
export type RecallStep = StudyStep;
/** @deprecated Use applyStudy */
export const applyRecall = applyStudy;
