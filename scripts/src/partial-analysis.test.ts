import assert from "node:assert/strict";
import test from "node:test";
import { parsePartialAnalysis, assessCaptureQuality } from "../../artifacts/api-server/src/lib/partialAnalysis";
import { calculateShotScore, COMPONENT_KEYS, ScoringEvidenceError } from "../../artifacts/api-server/src/lib/scoring";
import { videoSuccess } from "../../artifacts/api-server/src/lib/videoResponse";
import { videoResultSchema } from "../../artifacts/mobile/utils/analysisResponse";
import { analyzeExtractedVideo } from "../../artifacts/mobile/utils/videoAnalysisPipeline";

const model = () => ({
  personVisible: true, shotVisible: true, summary: "A visible, controlled shooting attempt.",
  shootingArmSide: "image-right", elbowVisible: true,
  components: Object.fromEntries(COMPONENT_KEYS.map(key => [key, { score: 80, feedback: "Visible evidence" }])),
});
function result(partial = false) {
  const parsed = parsePartialAnalysis(model());
  return videoSuccess({
    analysis: { ...parsed.analysis, overallScore: calculateShotScore(parsed.analysis.components).overallScore },
    ...assessCaptureQuality(parsed.analysis.components, [], partial),
    timestamp: "2026-11-14T00:00:00.000Z", bestFrameIndex: partial ? 0 : 1, totalFrames: 3,
    keyFrameIndices: partial ? [0] : [0, 1, 2],
    keyFrameTimestamps: partial ? [0] : [0, 100, 200],
    keyFrameLabels: partial ? ["Available frame"] : ["Dip", "Set Point", "Release"],
  });
}

test("partial model output defaults optional metadata and unobservable components, not scores", () => {
  const parsed = parsePartialAnalysis({
    personVisible: true, shotVisible: true, summary: "Visible shot",
    components: { stance: { score: 91, feedback: "Stable visible feet" }, eyeTracking: { score: null } },
  });
  assert.equal(calculateShotScore(parsed.analysis.components).overallScore, 91);
  assert.equal(parsed.analysis.components.eyeTracking.score, null);
  assert.equal(parsed.analysis.components.elbowPosition.score, null);
  assert.deepEqual(parsed.analysis.annotations, []);
  assert.deepEqual(parsed.analysis.drillRecommendations, []);
  assert.deepEqual(parsed.analysis.keyStrengths, []);
  assert.equal(assessCaptureQuality(parsed.analysis.components, []).confidence, "low");
});

test("confidence is bounded by observed coverage, serious capture issues and uncertain phases", () => {
  const { analysis } = parsePartialAnalysis(model());
  assert.equal(assessCaptureQuality(analysis.components, []).confidence, "high");
  analysis.components.eyeTracking.score = null;
  assert.equal(assessCaptureQuality(analysis.components, []).confidence, "medium");
  const quality = assessCaptureQuality(analysis.components, [
    { code: "blur", message: "Blurred release", severity: "major", tip: "Use brighter lighting." },
    { code: "distance", message: "Small subject", severity: "minor", tip: "Move the camera closer." },
  ]);
  assert.equal(quality.confidence, "low");
  assert.equal(quality.captureQuality.assessedComponents, 7);
  assert.equal(quality.captureQuality.tips.length, 3);
  assert.equal(quality.captureQuality.tips[0], "Use brighter lighting.");
  assert.equal(assessCaptureQuality(analysis.components, [], true).confidence, "low");
});

test("no person, no shot and no gradable evidence refuse honestly; malformed scores never become defaults", () => {
  for (const field of ["personVisible", "shotVisible"]) {
    assert.throws(() => parsePartialAnalysis({ ...model(), [field]: false }), ScoringEvidenceError);
  }
  const parsed = parsePartialAnalysis({ ...model(), components: {} });
  assert.throws(() => calculateShotScore(parsed.analysis.components), ScoringEvidenceError);
  for (const score of ["80", false, 101, -1, NaN]) {
    assert.throws(() => parsePartialAnalysis({
      ...model(), components: { stance: { score, feedback: "Invalid fixture" } },
    }));
  }
  assert.throws(() => parsePartialAnalysis({ ...model(), components: { stance: { score: 80 } } }));
});

test("optional malformed advice and unsupported annotation coordinates never invalidate observed scores", () => {
  const { analysis } = parsePartialAnalysis({
    ...model(), keyStrengths: null, priorityFixes: "bad", drillRecommendations: false,
    annotations: [
      { frameIndex: 0, zone: "stance", x: 0.5, y: 0.9, severity: "good", label: "Visible feet" },
      { frameIndex: 1, zone: "gripPosition", x: 0.5, y: 0.5, severity: "good", label: "Wrong slot" },
      { frameIndex: 0, zone: "balance", x: 1.5, y: 0.5, severity: "good", label: "Invalid location" },
    ],
  }, 1);
  assert.equal(calculateShotScore(analysis.components).overallScore, 80);
  assert.deepEqual(analysis.keyStrengths, []);
  assert.deepEqual(analysis.priorityFixes, []);
  assert.deepEqual(analysis.drillRecommendations, []);
  assert.equal(analysis.annotations?.length, 1);
});

test("partial score, capture quality and confidence round-trip with History while final schema rejects missing metadata", () => {
  const response = videoResultSchema.parse(result(true));
  const session = { id: "partial-test", imageUri: "", analysis: response.analysis,
    captureQuality: response.captureQuality, confidence: response.confidence };
  const saved = JSON.parse(JSON.stringify(session));
  assert.equal(saved.analysis.overallScore, 80);
  assert.equal(saved.confidence, "low");
  assert.equal(saved.captureQuality.tips.length, 1);
  const { confidence, ...malformed } = response;
  assert.throws(() => videoSuccess(malformed));
  assert.equal(videoResultSchema.safeParse(malformed).success, false);
});

test("uncertain phase response grades existing frames without invented phase labels", async () => {
  const modes: unknown[] = [];
  const extracted = { base64Frames: ["a", "b", "c"], thumbnailUris: ["a", "b", "c"],
    timestamps: [0, 100, 200], coarse: false, durationMs: 1000 };
  const response = await analyzeExtractedVideo({
    shootingHand: "right", extract: async () => extracted,
    request: async body => {
      modes.push(body);
      if (body.mode === "prepare") throw { data: { code: "FRAME_SELECTION_UNCERTAIN" } };
      assert.equal(body.availableEvidence, true);
      assert.equal(body.phaseIndices, undefined);
      return result(true);
    },
  });
  assert.equal(modes.length, 2);
  assert.equal(response.data.confidence, "low");
  assert.deepEqual(response.selectedIndices, [0]);
});

test("sparse extraction skips phase claims; malformed or infrastructure responses do not silently retry as evidence", async () => {
  const extracted = { base64Frames: ["a", "b", "c"], thumbnailUris: ["a", "b", "c"],
    timestamps: [0, 100, 200], coarse: false, durationMs: 1000, incomplete: true };
  let calls = 0;
  await analyzeExtractedVideo({
    shootingHand: "right", extract: async () => extracted,
    request: async body => { calls++; assert.equal(body.availableEvidence, true); return result(true); },
  });
  assert.equal(calls, 1);
  for (const broken of [null, "primitive", [], { ok: true }]) {
    await assert.rejects(analyzeExtractedVideo({
      shootingHand: "right", extract: async () => ({ ...extracted, incomplete: false }),
      request: async () => broken,
    }));
  }
  await assert.rejects(analyzeExtractedVideo({
    shootingHand: "right", extract: async () => ({ ...extracted, incomplete: false }),
    request: async () => { throw new Error("Network unavailable"); },
  }), /Network unavailable/);
});
