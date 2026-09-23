/** Pure selection contract; transport retries belong to the caller. */
export class FrameSelectionError extends Error {
  constructor() {
    super("Could not identify Dip, Set Point and Release reliably. Retry with a short, clear clip showing the complete shot.");
  }
}

export const FRAME_SELECTION_PROMPT = `Identify ONE complete basketball shot in the labeled chronological images.
Dip = lowest ball/body position immediately before upward shooting motion, with deepest knee flexion.
Set Point = ball at or above forehead and shooting elbow roughly 90 degrees, before final arm extension.
Release = LAST frame with fingertip contact with the ball, NOT the detached ball or follow-through.
Select the closest supplied visible frames of the SAME shot. Do not infer phases from percentages of clip duration.
Return ONLY JSON {"indices":[dipIndex,setPointIndex,releaseIndex]} with exactly three distinct numeric integers,
0-based indices matching the labels, in strictly increasing temporal order.
If any phase is not visible or cannot be distinguished, return {"indices":[]} instead of guessing.`;

export const LOCATE_SHOT_PROMPT = `These are coarse, explicitly labeled chronological video frames.
Locate the first complete basketball shot: choose the frame nearest the ball at the forehead or release.
This is only a coarse localization, NOT final phase selection.
Return ONLY JSON {"indices":[shotIndex]}, one numeric integer matching a supplied 0-based label.
If no shot is visible, return {"indices":[]}.`;

export function rhythmShotContext(indices: number[], timestamps: number[]) {
  return `Analyze ONLY the selected same shot: Dip index=${indices[0]} @ ${timestamps[indices[0]]}ms; Set Point index=${indices[1]} @ ${timestamps[indices[1]]}ms; Release index=${indices[2]} @ ${timestamps[indices[2]]}ms (last fingertip contact). Return these phase indices unchanged. Use preceding frames only to establish the rise leading into THIS shot; ignore any other shot. If rise timing cannot be identified, use -1 rather than choosing another shot.`;
}

export function providerFailure(error: unknown) {
  const e = error as { status?: number; message?: string };
  const dailyQuota = e?.status === 429 && /free-models-per-day|daily.{0,30}(quota|limit)|(quota|limit).{0,30}(daily|per.day)/i.test(e.message ?? "");
  return {
    status: e?.status === 429 ? 429 : 502,
    body: {
      error: dailyQuota
        ? "The analysis service's daily quota is exhausted. This is not a problem with your clip. Try again after the quota resets."
        : e?.status === 429
          ? "The analysis service is busy right now. This is not a problem with your clip. Please try again shortly."
          : "Video analysis failed. Please try again.",
      code: dailyQuota ? "PROVIDER_DAILY_QUOTA" : e?.status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_ERROR",
      retryable: true,
    },
  };
}

export function parseIndices(raw: string, count: number, expected = 3): number[] {
  // Permit a single complete JSON code fence, not prose, greedy brace extraction or coercion.
  const text = raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim();
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Response must be one JSON object"); }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !("indices" in value)) {
    throw new Error('Expected only the property "indices"');
  }
  const indices = (value as { indices: unknown }).indices;
  if (!Array.isArray(indices) || indices.length !== expected ||
      indices.some((n, i) => typeof n !== "number" || !Number.isInteger(n) ||
        n < 0 || n >= count || (i > 0 && n <= indices[i - 1]))) {
    throw new Error(`indices must contain exactly ${expected} increasing integers from 0 to ${count - 1}`);
  }
  return indices;
}

export function labeledImages(frames: string[], timestamps: number[], mimeType: string) {
  return frames.flatMap((b64, index) => [
    { type: "text" as const, text: `IMAGE index=${index}; original video timestamp=${timestamps[index]}ms. The next image has this label.` },
    { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${b64}`, detail: "high" as const } },
  ]);
}

export function unsupportedJsonFormat(error: unknown): boolean {
  const e = error as { status?: number; message?: string };
  return (e?.status === 400 || e?.status === 422) &&
    /response_format|json_object/i.test(e.message ?? "") &&
    /unsupported|not supported|not available|not permitted/i.test(e.message ?? "");
}

/** Raw text diagnostics are bounded and strip all free-form words (possible PII).
 * The JSON punctuation/numbers needed to diagnose this contract remain visible.
 * Never log the request, images, exception objects or assistant reasoning.
 */
export function safeSelectionDiagnostic(raw: string) {
  return raw.slice(0, 512)
    .replace(/data:[^\s"]+/gi, "[redacted]")
    .replace(/https?:\/\/[^\s"]+/gi, "[redacted]")
    .replace(/[\p{L}_][\p{L}_0-9@./:+-]*/gu, word =>
      ["indices", "json", "null", "true", "false"].includes(word) ? word : "[text]")
    .replace(/\d{4,}/g, "[number]")
    .slice(0, 512);
}

export async function selectWithCorrection(
  count: number,
  expected: number,
  request: (correction: string | undefined, jsonMode: boolean) => Promise<{ raw: string; finish?: string }>,
  diagnostic: (event: { attempt: number; raw: string; finish?: string; validation?: string }) => void,
): Promise<number[]> {
  let correction: string | undefined;
  let jsonMode = true;
  for (let attempt = 0; attempt < 3; attempt++) {
    let result;
    try {
      result = await request(correction, jsonMode);
    } catch (error) {
      if (!jsonMode || !unsupportedJsonFormat(error)) throw error;
      jsonMode = false;
      result = await request(correction, false);
    }
    try {
      if (result.finish !== "stop") throw new Error("Response incomplete or refused");
      const indices = parseIndices(result.raw, count, expected);
      diagnostic({ attempt, raw: safeSelectionDiagnostic(result.raw), finish: result.finish });
      return indices;
    } catch (error) {
      const validation = (error as Error).message;
      diagnostic({ attempt, raw: safeSelectionDiagnostic(result.raw), finish: result.finish, validation });
      correction = `Previous response was invalid: ${validation}. Reinspect the labeled images. Return exactly {"indices":[${expected === 3 ? "dip,setPoint,release" : "shot"}]} with ${expected} increasing integers in [0,${count - 1}]. If the phases are not visible return an empty indices array; never invent phases.`;
    }
  }
  throw new FrameSelectionError();
}