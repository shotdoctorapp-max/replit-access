import { AnalyzeVideoResponse } from "@workspace/api-zod";

export function videoSuccess(payload: Record<string, unknown>) {
  // Preserve top-level phase fields for already-installed clients. Every mode
  // also carries an object under analysis, while the final mode keeps its
  // existing biomechanics object there.
  return AnalyzeVideoResponse.parse({
    ...payload,
    ok: true,
    analysis: payload.analysis ?? payload,
  });
}
