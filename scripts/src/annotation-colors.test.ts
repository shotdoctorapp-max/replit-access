import assert from "node:assert/strict";
import test from "node:test";
import {
  TIER_COLORS, UNSCORED_COLOR, componentTierColor, frameTierSummary, knownTier, scoreToTier,
} from "../../artifacts/mobile/utils/grading";

test("four-tier palette and issue decisions share exactly one descriptor", () => {
  assert.deepEqual(TIER_COLORS, {
    Elite: "#A855F7",
    Pro: "#22C55E",
    Rising: "#F59E0B",
    Beginner: "#EF4444",
  });
  for (const [score, tier] of [[85, "Elite"], [70, "Pro"], [55, "Rising"], [40, "Beginner"], [0, "Beginner"]] as const) {
    assert.equal(knownTier(score), tier);
    assert.equal(componentTierColor(score), TIER_COLORS[tier]);
  }
  assert.equal(knownTier(undefined), null);
  assert.equal(knownTier(NaN), null);
  assert.equal(knownTier(-1), null);
  assert.equal(componentTierColor(undefined), UNSCORED_COLOR);
});

test("each frame summarizes its weakest scored annotated component, ignoring legacy severity", () => {
  const components = {
    stance: { score: 91 },
    elbowPosition: { score: 61 },
    gripPosition: { score: 72 },
    balance: { score: 43 },
    followThrough: { score: 12 },
  };
  const frames = [
    [{ zone: "stance", severity: "issue" }, { zone: "balance", severity: "good" }],
    [{ zone: "elbowPosition", severity: "good" }, { zone: "gripPosition", severity: "issue" }],
    [{ zone: "followThrough", severity: "good" }],
  ];
  assert.deepEqual(frames.map(a => frameTierSummary(a, components)), ["Beginner", "Rising", "Beginner"]);
  assert.equal(frameTierSummary([{ zone: "stance" }], components), "Elite");
  assert.equal(frameTierSummary([{ zone: "gripPosition" }], components), "Pro");
  assert.equal(frameTierSummary([{ zone: "missing" }], components), null);
  assert.equal(frameTierSummary([], components), null);
  assert.equal(frameTierSummary([{ zone: "stance" }], undefined), null);
  assert.equal(frameTierSummary([{ zone: "missing" }, { zone: "gripPosition" }], components), "Pro");
});