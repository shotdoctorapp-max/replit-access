import assert from "node:assert/strict";
import test from "node:test";
import { COMPONENT_KEYS, calculateShotScore, reliableRhythm, ScoringEvidenceError } from "../../artifacts/api-server/src/lib/scoring";
import { BIOMECHANICS_SYSTEM_PROMPT } from "../../artifacts/api-server/src/lib/prompts";

const components = (scores: number[]) => Object.fromEntries(COMPONENT_KEYS.map((key, i) =>
  [key, { score: scores[i], feedback: "Visible mechanical cue" }]));

test("total uses all eight equal component weights and the existing reliable rhythm share", () => {
  const input = components([50, 60, 70, 80, 90, 100, 40, 30]);
  assert.equal(calculateShotScore(input).overallScore, 65);
  assert.equal(calculateShotScore(input, 20).overallScore, 58);
  assert.equal(calculateShotScore(input, 0).overallScore, 55);
  assert.equal(calculateShotScore(input, 100).overallScore, 70);
  assert.equal(calculateShotScore(input).biomechanicsMean, 65);
});

test("round only the final value; no tier or model total can change the result", () => {
  const input = components(Array(8).fill(70.49));
  assert.equal(calculateShotScore(input, 73).overallScore, 71);
  for (let i = 0; i < 20; i++) assert.equal(calculateShotScore(input, 73).overallScore, 71);
  assert.equal(calculateShotScore(components(Array(8).fill(100)), 100).overallScore, 100);
  assert.equal(calculateShotScore(components(Array(8).fill(0)), 0).overallScore, 0);
});

test("changing visible component evidence affects the total without manufactured jitter", () => {
  const original = components(Array(8).fill(60));
  const changed = { ...original, followThrough: { score: 92, feedback: "Clearly extended arm and finished wrist" } };
  const before = JSON.stringify(changed);
  assert.equal(calculateShotScore(original).overallScore, 60);
  assert.equal(calculateShotScore(changed).overallScore, 64);
  assert.deepEqual(calculateShotScore(changed), calculateShotScore(changed));
  assert.equal(JSON.stringify(changed), before);
});

test("missing, nonnumeric, out-of-range, or unexplained evidence cannot produce a total", () => {
  for (const score of [undefined, null, NaN, Infinity, -1, 101, "72"]) {
    const input = { ...components(Array(8).fill(72)), stance: { score, feedback: "Cropped feet" } };
    assert.throws(() => calculateShotScore(input), ScoringEvidenceError);
  }
  assert.throws(() => calculateShotScore(null), ScoringEvidenceError);
  assert.throws(() => calculateShotScore({}), ScoringEvidenceError);
  const input = components(Array(8).fill(72));
  input.stance.feedback = "";
  assert.throws(() => calculateShotScore(input), ScoringEvidenceError);
  assert.throws(() => calculateShotScore(components(Array(8).fill(72)), NaN), ScoringEvidenceError);
});

test("rhythm requires original matched shot phases, known pattern, valid score and motion indices", () => {
  const rhythm = { dipFrame: 2, setPointFrame: 5, armExtendFrame: 8, ballRiseFrame: 3,
    bodyRiseFrame: 4, rhythmScore: 63, pattern: "synchronized", observations: ["Body and ball rise together"] };
  assert.equal(reliableRhythm(rhythm, [2, 5, 8]), true);
  for (const patch of [{ dipFrame: -1 }, { setPointFrame: 4 }, { armExtendFrame: -1 },
    { bodyRiseFrame: -1 }, { ballRiseFrame: 2.5 }, { bodyRiseFrame: 99 },
    { rhythmScore: NaN }, { rhythmScore: 101 }, { pattern: "unknown" }, { observations: [] }]) {
    assert.equal(reliableRhythm({ ...rhythm, ...patch }, [2, 5, 8]), false);
  }
  assert.equal(reliableRhythm(rhythm, [0]), false);
  assert.equal(reliableRhythm(null, [2, 5, 8]), false);
});

test("rubric requires observed phase evidence, permits missing scores, and removes leading diagnoses", () => {
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /Do not manufacture variation/);
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /feet are outside the image, stance must be null/);
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /eyeTracking must be null/);
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /server calculates the total/);
  assert.doesNotMatch(BIOMECHANICS_SYSTEM_PROMPT, /"overallScore":/);
  assert.doesNotMatch(BIOMECHANICS_SYSTEM_PROMPT, /Wrist not finishing|Stance too narrow|Eyes leaving the rim early/);
});
