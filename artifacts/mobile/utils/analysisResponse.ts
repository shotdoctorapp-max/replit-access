import { z } from "zod";
import type { VideoAnalysisResult } from "@workspace/api-client-react";

const component = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  feedback: z.string(),
  adjustments: z.array(z.string()).optional(),
});

// Runtime boundary: generated TypeScript alone cannot validate network JSON.
export const videoResultSchema: z.ZodType<VideoAnalysisResult> = z.object({
  ok: z.literal(true),
  analysis: z.object({
    overallScore: z.number().int().min(0).max(100),
    summary: z.string(),
    shootingArmSide: z.enum(["image-left", "image-right"]).optional(),
    elbowVisible: z.boolean().optional(),
    components: z.object({
      stance: component, hipAlignment: component, elbowPosition: component,
      gripPosition: component, setPoint: component, followThrough: component,
      balance: component, eyeTracking: component,
    }),
    keyStrengths: z.array(z.string()),
    priorityFixes: z.array(z.string()),
    drillRecommendations: z.array(z.object({ name: z.string(), description: z.string(), targetArea: z.string() })),
    annotations: z.array(z.object({
      frameIndex: z.number().int().nonnegative(), zone: z.string(),
      x: z.number().min(0).max(1), y: z.number().min(0).max(1),
      severity: z.enum(["good", "warning", "issue"]), label: z.string(),
    })).optional(),
  }),
  captureQuality: z.object({
    issues: z.array(z.object({
      code: z.string(), message: z.string(), tip: z.string(), severity: z.enum(["minor", "major"]),
    })),
    tips: z.array(z.string()).max(3),
    assessedComponents: z.number().int().min(1).max(8), totalComponents: z.literal(8),
  }),
  confidence: z.enum(["high", "medium", "low"]),
  rhythm: z.record(z.string(), z.unknown()).nullish(),
  timestamp: z.string().datetime(),
  bestFrameIndex: z.number().int().nonnegative(),
  totalFrames: z.number().int().positive(),
  keyFrameIndices: z.array(z.number().int().nonnegative()),
  keyFrameTimestamps: z.array(z.number().nonnegative()),
  keyFrameLabels: z.array(z.string()).optional(),
});
