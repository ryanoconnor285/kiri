import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCardSearchQuery } from "@kiri/schema";

test("web uses shared card search parser", () => {
  const p = parseCardSearchQuery("folder:abc is:suspended tag:lab");
  assert.equal(p.isSuspended, true);
  assert.deepEqual(p.tags, ["lab"]);
  assert.deepEqual(p.folderIds, ["abc"]);
});
