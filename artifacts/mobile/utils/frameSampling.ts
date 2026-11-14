// These are application safety bounds, not a claim about provider maximums.
export const MAX_SELECTION_IMAGES = 48;
export const COARSE_IMAGES = 32;
export const SAMPLE_STEP_MS = 100;
export const DENSE_WINDOW_MS = 4700;
export class NoReadableFramesError extends Error {}

export function planFrameTimes(durationMs: number, anchorMs?: number): { timestamps: number[]; coarse: boolean } {
  if (!Number.isFinite(durationMs) || durationMs < 300 || durationMs > 60_000) {
    throw new Error("Use a video between 0.3 and 60 seconds with a known duration.");
  }
  // Avoid asking the native decoder for a timestamp at/past EOF.
  const last = Math.max(0, Math.floor(durationMs) - 50);
  if (anchorMs === undefined && last > DENSE_WINDOW_MS) {
    return { coarse: true, timestamps: Array.from({ length: COARSE_IMAGES }, (_, i) =>
      Math.round(i * last / (COARSE_IMAGES - 1))) };
  }
  if (anchorMs !== undefined && (!Number.isFinite(anchorMs) || anchorMs < 0 || anchorMs > last)) {
    throw new Error("Invalid shot localization timestamp. Please retry.");
  }
  const start = anchorMs === undefined ? 0 :
    Math.max(0, Math.min(Math.floor((anchorMs - 3400) / SAMPLE_STEP_MS) * SAMPLE_STEP_MS, last - DENSE_WINDOW_MS));
  const end = Math.min(last, start + DENSE_WINDOW_MS);
  return { coarse: false, timestamps: Array.from({ length: Math.floor((end - start) / SAMPLE_STEP_MS) + 1 },
    (_, i) => start + i * SAMPLE_STEP_MS) };
}

export function validateFrameMapping(
  indices: unknown, serverTimes: unknown, totalFrames: number,
  timestamps: number[], thumbnailUris: string[],
  expectedCount = 3,
): number[] {
  if (totalFrames !== timestamps.length || thumbnailUris.length !== timestamps.length ||
      !Array.isArray(indices) || indices.length !== expectedCount ||
      !Array.isArray(serverTimes) || serverTimes.length !== expectedCount ||
      indices.some((n, i) => typeof n !== "number" || !Number.isInteger(n) || n < 0 ||
        n >= timestamps.length || (i > 0 && n <= indices[i - 1]) ||
        !thumbnailUris[n] || serverTimes[i] !== timestamps[n])) {
    throw new Error("Phase frames could not be matched to the video. Please retry analysis.");
  }
  return indices;
}