import assert from "node:assert/strict";
import { test } from "node:test";
import { applyStudy, EMPTY_STUDY_META, leaveQuality } from "./recall-queue.ts";

test("Right parks the card as Good", () => {
  const step = applyStudy(EMPTY_STUDY_META, "right");
  assert.equal(step.submit, 4);
  assert.equal(step.done, true);
});

test("Wrong stays in the hopper without writing SM-2", () => {
  const step = applyStudy(EMPTY_STUDY_META, "wrong");
  assert.equal(step.submit, null);
  assert.equal(step.done, false);
  assert.equal(step.meta.wrongAttempts, 1);
});

test("Wrong then Right still submits Good only once", () => {
  const afterWrong = applyStudy(EMPTY_STUDY_META, "wrong");
  const afterRight = applyStudy(afterWrong.meta, "right");
  assert.equal(afterRight.submit, 4);
  assert.equal(afterRight.done, true);
});

test("Leave after Wrong writes a miss; untouched cards do not", () => {
  const wrong = applyStudy(EMPTY_STUDY_META, "wrong");
  assert.equal(leaveQuality(wrong.meta), 0);
  assert.equal(leaveQuality(EMPTY_STUDY_META), null);
});
