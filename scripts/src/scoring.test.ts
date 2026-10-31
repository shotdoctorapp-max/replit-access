import assert from "node:assert/strict";
import test from "node:test";
import { COMPONENT_KEYS, calculateShotScore, enforceElbowEvidence, reliableRhythm, ScoringEvidenceError } from "../../artifacts/api-server/src/lib/scoring";
import { BIOMECHANICS_SYSTEM_PROMPT } from "../../artifacts/api-server/src/lib/prompts";
import { AnalyzeFormResponse } from "../../lib/api-zod/src/generated/api";
import { knownTier, scoreToTier, tierColor, UNSCORED_COLOR } from "../../artifacts/mobile/utils/grading";

const components = (scores: number[]) => Object.fromEntries(COMPONENT_KEYS.map((key, i) =>
  [key, { score: scores[i], feedback: "Visible mechanical cue" }]));

test("total uses the requested 1.5x component weights and reliable 15% rhythm share", () => {
  const input = components([50, 60, 70, 80, 90, 100, 40, 30]);
  assert.equal(calculateShotScore(input).overallScore, 68);
  assert.equal(calculateShotScore(input, 20).overallScore, 61);
  assert.equal(calculateShotScore(input, 0).overallScore, 58);
  assert.equal(calculateShotScore(input, 100).overallScore, 73);
  assert.equal(calculateShotScore(input).biomechanicsMean, 650 / 9.5);
});

test("round only the final value; no tier or model total can change the result", () => {
  const input = components(Array(8).fill(70.49));
  assert.equal(calculateShotScore(input, 73).overallScore, 71);
  for (let i = 0; i < 20; i++) assert.equal(calculateShotScore(input, 73).overallScore, 71);
  assert.equal(calculateShotScore(components(Array(8).fill(100)), 100).overallScore, 100);
  assert.equal(calculateShotScore(components(Array(8).fill(0)), 0).overallScore, 0);
});

test("mostly Pro/Elite mechanics plus low rhythm cannot collapse to a fake zero", () => {
  const screenshotLike = components([85, 85, 60, 85, 85, 85, 85, 0]);
  assert.equal(calculateShotScore(screenshotLike, 20).overallScore, 64);
  assert.throws(() => calculateShotScore({ ...screenshotLike, stance: { score: "Elite", feedback: "Invalid model score" } }, 20),
    ScoringEvidenceError);
});

test("changing visible component evidence affects the total without manufactured jitter", () => {
  const original = components(Array(8).fill(60));
  const changed = { ...original, followThrough: { score: 92, feedback: "Clearly extended arm and finished wrist" } };
  const before = JSON.stringify(changed);
  assert.equal(calculateShotScore(original).overallScore, 60);
  assert.equal(calculateShotScore(changed).overallScore, 65);
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

test("only an explicitly unobservable elbow is excluded without inventing a score", () => {
  const input = { ...components(Array(8).fill(72)), elbowPosition: { score: null, feedback: "Can't see from this angle" } };
  const before = JSON.stringify(input);
  for (const rhythm of [null, 90]) {
    const result = calculateShotScore(input, rhythm);
    assert.equal(result.overallScore, rhythm === null ? 72 : 75);
    assert.equal(result.biomechanicsMean, 72);
    assert.equal(result.componentScores[2], null);
    assert.equal(result.componentScores[1], 72);
  }
  assert.equal(JSON.stringify(input), before);
  const none = Object.fromEntries(COMPONENT_KEYS.map(key => [key, { score: null, feedback: "Not visible" }]));
  assert.throws(() => calculateShotScore(none), ScoringEvidenceError);
  const model = { shootingArmSide: "image-left", elbowVisible: false,
    components: components(Array(8).fill(80)),
    annotations: [{ zone: "elbowPosition", label: "Incorrect hidden-elbow diagnosis" }, { zone: "stance", label: "Visible base" }] };
  enforceElbowEvidence(model);
  assert.equal(model.components.elbowPosition.score, null);
  assert.deepEqual(model.components.elbowPosition, { score: null, feedback: "Can't see from this angle" });
  assert.deepEqual(model.annotations, [{ zone: "stance", label: "Visible base" }]);
  assert.throws(() => enforceElbowEvidence({ components: input }), ScoringEvidenceError);
});

test("partial results survive the API contract and JSON round trip without inventing a grade", () => {
  const scored = components(Array(8).fill(72));
  const partial = { ...scored, eyeTracking: { score: null, feedback: "Eyes are not clearly visible" } };
  const response = { analysis: { overallScore: null, summary: "Visible mechanics only",
    components: partial, keyStrengths: [], priorityFixes: [], drillRecommendations: [] },
    timestamp: new Date(0).toISOString() };
  const parsed = AnalyzeFormResponse.parse(JSON.parse(JSON.stringify(response)));
  assert.equal(parsed.analysis.overallScore, null);
  assert.equal(parsed.analysis.components.stance.score, 72);
  assert.equal(parsed.analysis.components.eyeTracking.score, null);
  assert.equal(scoreToTier(null).label, "—");
  assert.equal(knownTier(null), null);
  assert.equal(tierColor(null), UNSCORED_COLOR);
  const old = { ...response, analysis: { ...response.analysis, components: scored, overallScore: 83 } };
  assert.equal(AnalyzeFormResponse.parse(old).analysis.overallScore, 83);
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
  const current = { ...rhythm, armExtendFrame: 6, ballLeavesHandFrame: 7, followThroughFrame: 8 };
  assert.equal(reliableRhythm(current, [2, 5, 8]), true);
  assert.equal(reliableRhythm({ ...current, followThroughFrame: 7 }, [2, 5, 8]), false);
  assert.equal(reliableRhythm({ ...current, armExtendFrame: -1 }, [2, 5, 8]), false);
});

test("rubric requires observed phase evidence, permits missing scores, and removes leading diagnoses", () => {
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /Do not manufacture variation/);
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /feet are outside the image, stance must be null/);
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /eyeTracking must be null/);
  assert.match(BIOMECHANICS_SYSTEM_PROMPT, /server calculates the total/);
  assert.doesNotMatch(BIOMECHANICS_SYSTEM_PROMPT, /"overallScore":/);
  assert.doesNotMatch(BIOMECHANICS_SYSTEM_PROMPT, /Wrist not finishing|Stance too narrow|Eyes leaving the rim early/);
});
