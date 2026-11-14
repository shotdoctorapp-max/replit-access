import { AnalyzeVideoResponse } from "@workspace/api-zod";

export function videoSuccess(payload: Record<string, unknown>) {
  // Preserve top-level phase fields for already-installed clients. Every mode
  // also carries an object under analysis, while the final mode keeps its
  // existing biomechanics object there.
  const envelope = {
    ...payload,
    ok: true,
    analysis: payload.analysis ?? payload,
  };
  // A malformed final result must not fall through to the permissive phase
  // preparation branch simply because it also has keyFrameIndices.
  if ("bestFrameIndex" in payload) return AnalyzeVideoResponse.options[0].parse(envelope);
  return AnalyzeVideoResponse.parse(envelope);
}
