export const COMPONENT_KEYS = [
  "stance", "hipAlignment", "elbowPosition", "gripPosition",
  "setPoint", "followThrough", "balance", "eyeTracking",
] as const;

export const RHYTHM_WEIGHT = 0.15;
export function enforceElbowEvidence(analysis: any) {
  if (!analysis || !analysis.components) {
    throw new ScoringEvidenceError();
  }
  if (analysis.elbowVisible !== true || !["image-left", "image-right"].includes(analysis.shootingArmSide)) {
    analysis.components.elbowPosition = { score: null, feedback: "Can't see from this angle" };
    if (Array.isArray(analysis.annotations)) {
      analysis.annotations = analysis.annotations.filter((annotation: { zone?: unknown } | null) =>
        annotation?.zone !== "elbowPosition");
    }
  }
}
export const COMPONENT_WEIGHTS = Object.fromEntries(COMPONENT_KEYS.map(key =>
  [key, ["followThrough", "elbowPosition", "setPoint"].includes(key) ? 1.5 : 1])) as Record<typeof COMPONENT_KEYS[number], number>;

export class ScoringEvidenceError extends Error {
  constructor() {
    super("We couldn't find enough visible shooting mechanics to grade. Please film a person taking a shot and try again.");
  }
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

/** Weighted evidence composite over observed components only.
 * Missing evidence is excluded, never zero-filled. Corrupt scores still fail.
 * Rhythm contributes 15% only when independently validated. Round once.
 */
export function calculateShotScore(components: unknown, reliableRhythmScore: unknown = null) {
  if (!components || typeof components !== "object" || Array.isArray(components)) throw new ScoringEvidenceError();
  const source = components as Record<string, { score?: unknown; feedback?: unknown } | undefined>;
  const scores = COMPONENT_KEYS.map(key => {
    const component = source[key];
    if (!component) return null;
    if ((component.score !== null && component.score !== undefined && !validScore(component.score)) ||
        typeof component.feedback !== "string" || !component.feedback.trim()) {
      throw new ScoringEvidenceError();
    }
    return component.score ?? null;
  });
  if (reliableRhythmScore !== null && !validScore(reliableRhythmScore)) throw new ScoringEvidenceError();
  const denominator = COMPONENT_KEYS.reduce((sum, key, i) => sum + (scores[i] === null ? 0 : COMPONENT_WEIGHTS[key]), 0);
  if (denominator === 0) throw new ScoringEvidenceError();
  const biomechanicsMean = COMPONENT_KEYS.reduce((sum, key, i) =>
    sum + (scores[i] === null ? 0 : (scores[i] as number) * COMPONENT_WEIGHTS[key]), 0) / denominator;
  const total = reliableRhythmScore === null
    ? biomechanicsMean
    : biomechanicsMean * (1 - RHYTHM_WEIGHT) + (reliableRhythmScore as number) * RHYTHM_WEIGHT;
  return { overallScore: Math.round(Math.max(0, Math.min(100, total))), biomechanicsMean, componentScores: scores };
}

/** Check the model's ORIGINAL phase evidence before authoritative indices replace it. */
export function reliableRhythm(
  value: unknown, selected: readonly number[],
): value is { rhythmScore: number; [key: string]: unknown } {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const [dip, setPoint, release] = selected;
  if (selected.length !== 3 || !validScore(r.rhythmScore) ||
      !["synchronized", "set-then-drive", "disconnected"].includes(String(r.pattern)) ||
      r.dipFrame !== dip || r.setPointFrame !== setPoint ||
      (r.followThroughFrame ?? r.armExtendFrame) !== release ||
      !Array.isArray(r.observations) || r.observations.length === 0 ||
      !r.observations.every(o => typeof o === "string" && o.trim())) return false;
  if (r.followThroughFrame !== undefined && ![r.armExtendFrame, r.ballLeavesHandFrame].every(index =>
    typeof index === "number" && Number.isInteger(index) && index >= setPoint && index <= release)) return false;
  return [r.ballRiseFrame, r.bodyRiseFrame].every(index =>
    typeof index === "number" && Number.isInteger(index) && index >= 0 && index <= release);
}
