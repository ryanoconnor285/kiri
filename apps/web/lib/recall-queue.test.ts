import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRecall, EMPTY_RECALL_META, leaveQuality } from "./recall-queue.ts";

test("Total parks the card as Good", () => {
  const step = applyRecall(EMPTY_RECALL_META, "total");
  assert.equal(step.submit, 4);
  assert.equal(step.done, true);
});

test("Fuzzy stays in the hopper without writing SM-2", () => {
  const step = applyRecall(EMPTY_RECALL_META, "fuzzy");
  assert.equal(step.submit, null);
  assert.equal(step.done, false);
  assert.equal(step.meta.pendingFuzzy, true);
  assert.equal(step.meta.looks, 1);
});

test("three Fuzzy looks force Hard and leave the hopper", () => {
  let meta = EMPTY_RECALL_META;
  meta = applyRecall(meta, "fuzzy").meta;
  meta = applyRecall(meta, "fuzzy").meta;
  const step = applyRecall(meta, "fuzzy");
  assert.equal(step.submit, 3);
  assert.equal(step.done, true);
});

test("Zero writes a miss once and requeues", () => {
  const first = applyRecall(EMPTY_RECALL_META, "zero");
  assert.equal(first.submit, 0);
  assert.equal(first.done, false);
  const second = applyRecall(first.meta, "zero");
  assert.equal(second.submit, null);
  assert.equal(second.done, false);
});

test("Zero then Total still submits Good from the reset state", () => {
  const afterZero = applyRecall(EMPTY_RECALL_META, "zero");
  const afterTotal = applyRecall(afterZero.meta, "total");
  assert.equal(afterTotal.submit, 4);
  assert.equal(afterTotal.done, true);
});

test("Leave after Fuzzy writes Hard; Leave after Zero does not", () => {
  const fuzzy = applyRecall(EMPTY_RECALL_META, "fuzzy");
  assert.equal(leaveQuality(fuzzy.meta), 3);
  const zero = applyRecall(EMPTY_RECALL_META, "zero");
  assert.equal(leaveQuality(zero.meta), null);
});
