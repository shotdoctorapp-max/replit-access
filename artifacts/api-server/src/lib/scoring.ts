export const COMPONENT_KEYS = [
  "stance", "hipAlignment", "elbowPosition", "gripPosition",
  "setPoint", "followThrough", "balance", "eyeTracking",
] as const;

export const RHYTHM_WEIGHT = 0.15;

export class ScoringEvidenceError extends Error {
  constructor() {
    super("Some shooting mechanics could not be assessed clearly. Film your full body and keep your hands and release visible, then try again.");
  }
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

/** Equal component weights (1/8). Reliable rhythm retains the existing 15%.
 * Explicitly unassessable components retain feedback but suppress the total.
 * Neither a default score nor a changing denominator fills missing evidence.
 */
export function calculateShotScore(components: unknown, reliableRhythmScore: unknown = null) {
  if (!components || typeof components !== "object" || Array.isArray(components)) throw new ScoringEvidenceError();
  const source = components as Record<string, { score?: unknown; feedback?: unknown } | undefined>;
  const scores = COMPONENT_KEYS.map(key => {
    const component = source[key];
    if (!component || (component.score !== null && !validScore(component.score)) ||
        typeof component.feedback !== "string" || !component.feedback.trim()) {
      throw new ScoringEvidenceError();
    }
    return component.score;
  });
  if (reliableRhythmScore !== null && !validScore(reliableRhythmScore)) throw new ScoringEvidenceError();
  if (scores.some(score => score === null)) {
    return { overallScore: null, biomechanicsMean: null, componentScores: scores };
  }
  const biomechanicsMean = (scores as number[]).reduce((sum, score) => sum + score, 0) / COMPONENT_KEYS.length;
  const total = reliableRhythmScore === null
    ? biomechanicsMean
    : biomechanicsMean * (1 - RHYTHM_WEIGHT) + (reliableRhythmScore as number) * RHYTHM_WEIGHT;
  return { overallScore: Math.round(total), biomechanicsMean, componentScores: scores };
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
      r.dipFrame !== dip || r.setPointFrame !== setPoint || r.armExtendFrame !== release ||
      !Array.isArray(r.observations) || r.observations.length === 0 ||
      !r.observations.every(o => typeof o === "string" && o.trim())) return false;
  return [r.ballRiseFrame, r.bodyRiseFrame].every(index =>
    typeof index === "number" && Number.isInteger(index) && index >= 0 && index <= release);
}
