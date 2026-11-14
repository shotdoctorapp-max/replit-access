import { z } from "zod";
import { AnalyzeFormResponse, type CaptureIssue, type CaptureQuality, type AnalysisConfidence } from "@workspace/api-zod";
import { COMPONENT_KEYS, enforceElbowEvidence, ScoringEvidenceError } from "./scoring";

const resultSchema = AnalyzeFormResponse.shape.analysis.omit({ overallScore: true });
const componentSchema = z.object({
  score: z.number().int().min(0).max(100).nullable().optional(),
  feedback: z.string().trim().optional(),
  adjustments: z.array(z.string().trim().min(1)).optional(),
});
const issueSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  tip: z.string().trim().min(1),
  severity: z.enum(["minor", "major"]),
});
const modelSchema = resultSchema.omit({ components: true }).extend({
  personVisible: z.boolean(),
  shotVisible: z.boolean(),
  summary: z.string().trim().min(1),
  components: z.object(Object.fromEntries(COMPONENT_KEYS.map(key => [key, componentSchema.optional()]))),
  keyStrengths: z.array(z.string()).catch([]),
  priorityFixes: z.array(z.string()).catch([]),
  drillRecommendations: resultSchema.shape.drillRecommendations.catch([]),
  annotations: resultSchema.shape.annotations.catch([]),
  captureQuality: z.object({ issues: z.array(issueSchema).max(12).default([]) }).default({ issues: [] }),
});

export function parsePartialAnalysis(raw: unknown, annotationFrames = 3) {
  const parsed = modelSchema.parse(raw);
  if (!parsed.personVisible || !parsed.shotVisible) throw new ScoringEvidenceError();
  const components = Object.fromEntries(COMPONENT_KEYS.map(key => {
    const value = parsed.components[key];
    const score = value?.score ?? null;
    if (score !== null && !value?.feedback) throw new Error("Scored component needs observed feedback");
    return [key, {
      score,
      feedback: value?.feedback || "Not clearly visible in the available frames.",
      ...(score !== null && value?.adjustments ? { adjustments: value.adjustments } : {}),
    }];
  }));
  const analysis = resultSchema.parse({ ...parsed, components });
  enforceElbowEvidence(analysis);
  // Unknown mechanics cannot acquire annotations or corrective diagnoses.
  analysis.annotations = (analysis.annotations ?? []).filter(annotation =>
    Number.isInteger(annotation.frameIndex) && annotation.frameIndex >= 0 && annotation.frameIndex < annotationFrames &&
    [annotation.x, annotation.y].every(position => Number.isFinite(position) && position >= 0 && position <= 1) &&
    COMPONENT_KEYS.includes(annotation.zone as typeof COMPONENT_KEYS[number]) &&
    analysis.components[annotation.zone as typeof COMPONENT_KEYS[number]].score !== null);
  return { analysis, issues: parsed.captureQuality.issues };
}

export function assessCaptureQuality(
  components: Record<string, { score: number | null }>,
  modelIssues: CaptureIssue[],
  incompletePhases = false,
): { captureQuality: CaptureQuality; confidence: AnalysisConfidence } {
  const assessedComponents = COMPONENT_KEYS.filter(key => typeof components[key]?.score === "number").length;
  const issues: CaptureIssue[] = [...modelIssues];
  if (incompletePhases) issues.unshift({
    code: "incomplete_phases", severity: "major",
    message: "The complete shot sequence wasn't clearly available.",
    tip: "Record one shot from the gather through the finish, keeping the camera still.",
  });
  if (assessedComponents < 8 && !issues.some(issue => issue.code === "limited_visibility")) issues.push({
    code: "limited_visibility", severity: assessedComponents < 4 ? "major" : "minor",
    message: `We could assess ${assessedComponents} of 8 mechanics from this view.`,
    tip: "Keep your full body, ball and shooting hand visible from a clear front-side angle.",
  });
  issues.sort((a, b) => Number(b.severity === "major") - Number(a.severity === "major"));
  const confidence: AnalysisConfidence = assessedComponents < 4 || issues.some(issue => issue.severity === "major")
    ? "low" : assessedComponents < 7 || issues.length > 0 ? "medium" : "high";
  return {
    confidence,
    captureQuality: {
      issues,
      tips: [...new Set(issues.map(issue => issue.tip))].slice(0, 3),
      assessedComponents, totalComponents: 8,
    },
  };
}
