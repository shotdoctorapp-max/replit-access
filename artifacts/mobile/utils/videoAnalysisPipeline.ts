import { z } from "zod";
import type { AnalyzeVideoRequest } from "@workspace/api-client-react";
import type { ExtractedFrames } from "./videoFrames";
import { NoReadableFramesError, validateFrameMapping } from "./frameSampling";
import { planReleaseTimes, mergeRefinedRelease } from "./releaseRefinement";
import { videoResultSchema } from "./analysisResponse";
import { isObject } from "./analysisErrors";

class IncompletePhases extends Error {}

export function isPhaseSelectionError(error: unknown): boolean {
  return isObject(error) && "data" in error && isObject(error.data) &&
    "code" in error.data && error.data.code === "FRAME_SELECTION_UNCERTAIN";
}

type PipelineOptions = {
  extract: (anchor?: number, times?: number[]) => Promise<ExtractedFrames>;
  request: (body: AnalyzeVideoRequest) => Promise<unknown>;
  shootingHand: "right" | "left";
  onAnalyzing?: () => void;
};

export async function analyzeExtractedVideo({ extract, request, shootingHand, onAnalyzing }: PipelineOptions) {
  let extracted = await extract();
  let phaseIndices: number[] | undefined;
  const send = (frames: Pick<ExtractedFrames, "base64Frames" | "timestamps">, mode: AnalyzeVideoRequest["mode"]) =>
    request({ frames: frames.base64Frames, timestamps: frames.timestamps, shootingHand, mimeType: "image/jpeg", mode });
  try {
    if (extracted.incomplete) throw new IncompletePhases();
    if (extracted.coarse) {
      const location = z.object({
        ok: z.literal(true), shotIndex: z.number().int().nonnegative(),
        shotTimestamp: z.number().nonnegative(), totalFrames: z.number().int(),
      }).parse(await send(extracted, "locate"));
      if (location.totalFrames !== extracted.timestamps.length ||
          location.shotTimestamp !== extracted.timestamps[location.shotIndex]) throw new Error("Shot location mismatch");
      const dense = await extract(location.shotTimestamp);
      if (dense.incomplete) {
        // Keep the full coarse clip if the narrower window cannot be decoded.
        throw new IncompletePhases();
      }
      extracted = dense;
    }
    const preparation = z.object({
      ok: z.literal(true), keyFrameIndices: z.array(z.number()), keyFrameTimestamps: z.array(z.number()),
      totalFrames: z.number(),
    }).parse(await send(extracted, "prepare"));
    const prepared = validateFrameMapping(preparation.keyFrameIndices, preparation.keyFrameTimestamps,
      preparation.totalFrames, extracted.timestamps, extracted.thumbnailUris);
    let times: number[];
    try {
      times = planReleaseTimes(extracted.timestamps[prepared[2]], extracted.durationMs, extracted.timestamps[prepared[1]]);
    } catch {
      throw new IncompletePhases();
    }
    const fine = await extract(undefined, times);
    if (fine.incomplete) throw new IncompletePhases();
    const refinement = z.object({
      ok: z.literal(true), releaseIndex: z.number().int().nonnegative(),
      releaseTimestamp: z.number().nonnegative(), totalFrames: z.number().int(),
    }).parse(await send(fine, "refine-release"));
    if (refinement.totalFrames !== fine.timestamps.length ||
        refinement.releaseTimestamp !== fine.timestamps[refinement.releaseIndex]) throw new Error("Release frame mismatch");
    const merged = mergeRefinedRelease(extracted, prepared, fine, refinement.releaseIndex);
    extracted = { ...extracted, ...merged };
    phaseIndices = merged.phaseIndices;
  } catch (error) {
    if (!(error instanceof IncompletePhases) && !(error instanceof NoReadableFramesError) &&
        !isPhaseSelectionError(error)) throw error;
    // Explicitly uncertain phases are not invented, nor relabeled as validated.
  }
  onAnalyzing?.();
  const data = videoResultSchema.parse(await request({
    frames: extracted.base64Frames, timestamps: extracted.timestamps, shootingHand, mimeType: "image/jpeg",
    mode: "analyze", ...(phaseIndices ? { phaseIndices } : { availableEvidence: true }),
  }));
  const selectedIndices = validateFrameMapping(data.keyFrameIndices, data.keyFrameTimestamps,
    data.totalFrames, extracted.timestamps, extracted.thumbnailUris, phaseIndices ? 3 : 1);
  if (data.bestFrameIndex !== selectedIndices[phaseIndices ? 1 : 0] ||
      (data.keyFrameLabels && data.keyFrameLabels.length !== selectedIndices.length) ||
      data.analysis.annotations?.some(annotation => annotation.frameIndex >= selectedIndices.length)) {
    throw new Error("Analysis frame mismatch");
  }
  return { data, selectedIndices, ...extracted };
}
