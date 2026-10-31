import assert from "node:assert/strict";
import test from "node:test";
import { planReleaseTimes, mergeRefinedRelease } from "../../artifacts/mobile/utils/releaseRefinement";
import { validateRefinedRelease } from "../../artifacts/api-server/src/lib/releaseRefinement";
import { scoreToTier, componentTierColor } from "../../artifacts/mobile/utils/grading";

test("33ms refinement samples both sides of an anchor, clips at real EOF, never guesses a frame", () => {
  assert.deepEqual(planReleaseTimes(1000, 4000, 700), [900, 933, 966, 999, 1032, 1065, 1098, 1131, 1164, 1197, 1230]);
  const nearEnd = planReleaseTimes(3980, 4000, 3700);
  assert(nearEnd.every(t => t <= 3950 && t > 3700));
  assert.throws(() => planReleaseTimes(1000, 1000, 700));
  assert.throws(() => planReleaseTimes(1000, 4000, 1000));
  assert.throws(() => validateRefinedRelease('{"indices":[]}', "stop", 11));
  assert.throws(() => validateRefinedRelease('{"indices":[11]}', "stop", 11));
  assert.throws(() => validateRefinedRelease('{"indices":[3]}', "length", 11));
  assert.equal(validateRefinedRelease('{"indices":[3]}', "stop", 11), 3);
});

test("verified release image, timestamp and annotation slot remain the same through final analysis and persistence", () => {
  const original = { timestamps: Array.from({ length: 12 }, (_, i) => i * 100),
    thumbnailUris: Array.from({ length: 12 }, (_, i) => `old:${i}`),
    base64Frames: Array.from({ length: 12 }, (_, i) => `b64:${i}`) };
  const fine = { timestamps: [699, 732, 765], thumbnailUris: ["fine:0", "fine:1", "fine:2"],
    base64Frames: ["fine64:0", "fine64:1", "fine64:2"] };
  const merged = mergeRefinedRelease(original, [1, 5, 8], fine, 1);
  const release = merged.phaseIndices[2];
  assert.equal(merged.timestamps[release], 732);
  assert.equal(merged.thumbnailUris[release], "fine:1");
  assert.equal(merged.base64Frames[release], "fine64:1");
  assert.equal(merged.timestamps[merged.phaseIndices[0]], 100);
  assert.equal(merged.timestamps[merged.phaseIndices[1]], 500);
  assert.equal(merged.timestamps.length, 12);
  assert.throws(() => mergeRefinedRelease(original, [1, 5, 8], fine, -1));
});

test("Pro never needs work and missing scores are not Beginner or zero", () => {
  for (const score of [70, 74, 75, 84]) {
    assert.equal(scoreToTier(score).label, "Pro");
    assert.equal(scoreToTier(score).needsWork, false);
    assert.equal(componentTierColor(score), scoreToTier(score).color);
  }
  assert.equal(scoreToTier(69).needsWork, true);
  assert.equal(scoreToTier(0).label, "Beginner");
  for (const missing of [undefined, null, NaN, "72", -1, 101]) {
    assert.equal(scoreToTier(missing).label, "—");
    assert.equal(scoreToTier(missing).score, null);
    assert.equal(scoreToTier(missing).needsWork, false);
  }
});
