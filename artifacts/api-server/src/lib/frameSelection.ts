/** Pure selection contract; transport retries belong to the caller. */
export class FrameSelectionError extends Error {
  constructor() {
    super("Could not identify Dip, Set Point and Release reliably. Retry with a short, clear clip showing the complete shot.");
  }
}

export const SET_RELEASE_SELECTION_PROMPT = `Identify ONE complete basketball shot in the labeled chronological images.
Set Point = the LAST clearly loaded frame BEFORE sustained shooting-arm extension begins:
- ball at or near forehead/temple height;
- INSIDE angle at the shooting elbow is closest to a right angle (roughly 90 degrees, allowing for perspective);
- upper arm and forearm form a clear bent "L" shape, with the forearm rising from elbow toward the ball;
- forearm and upper arm still visibly loaded, NOT already midway through straightening.
Find the first neighboring frame where the shooting elbow clearly opens and the hand/ball rise through extension,
then choose the immediately PRECEDING supplied frame that best satisfies the loaded roughly-90-degree position.
Do NOT call an elbow angle above roughly 120 degrees "90 degrees." Reject a frame where the upper arm and forearm
already form a mostly straight line, even if the ball is still near the head.

Release = the EARLIEST clear POST-RELEASE frame after the ball has left the shooting fingertips:
- a visible gap separates the ball from every shooting fingertip;
- shooting arm is extended;
- shooting wrist has snapped forward/down into follow-through.
Compare neighboring images. Reject any frame where the ball still touches or overlaps the fingertips, the wrist
is still loaded/upright, or the arm is only midway through extension. Do not wait for a later full follow-through
when an earlier supplied frame already shows separation, extension, and wrist snap.

Select the closest supplied visible frames of the SAME shot. Do not infer phases from percentages of clip duration.
Return ONLY JSON {"indices":[setPointIndex,releaseIndex]} with exactly two distinct numeric integers,
0-based indices matching the labels, in strictly increasing temporal order.
If any phase is not visible or cannot be distinguished, return {"indices":[]} instead of guessing.`;

export const VERIFY_RELEASE_PROMPT = `Examine these consecutive images from AFTER the Set Point of ONE basketball shot.
Independently find the EARLIEST supplied image that clearly shows ALL of the following at once:
1. Visible empty space between the ball and EVERY fingertip of the SHOOTING hand. The ball must not touch or overlap the shooting hand, even at its edge.
2. The shooting arm is extended, not merely beginning to straighten.
3. The shooting wrist is snapped forward/down into follow-through, not upright or still pushing the ball.
Inspect the ball-hand boundary closely in each neighboring image. A ball above the hand is not enough if any fingertip still touches it.
The ball must be moving AWAY from the shooting hand during the first release, not descending back toward the hands.
Reject a late frame after the shooting arm starts retracting or a ball rebounds/returns, even if the ball is separate then.
Do not assume an image is post-release merely because it follows Set Point. Blurry, obscured or ambiguous contact does NOT count as clear separation.
If no supplied image clearly meets all three cues, return {"indices":[]} rather than guessing or selecting the last frame.
Return ONLY JSON {"indices":[index]} with exactly one 0-based index matching the supplied image labels, or {"indices":[]} when uncertain.`;

export const DIP_SELECTION_PROMPT = `Identify the Dip of the SAME basketball shot in these labeled chronological images.
Dip is defined ONLY by BALL POSITION: the final frame where the ball is at its lowest visible vertical position
immediately before it begins sustained upward shooting movement toward the Set Point.
Compare the CENTER of the ball across neighboring images using the fixed image coordinates:
lower on screen = closer to the BOTTOM image edge; upward = progressively closer to the TOP image edge.
Choose the image where the ball center is closest to the bottom edge. If several adjacent images are tied at
the same lowest height, choose the LAST tied image before the rise. A valid Dip must then be followed by at
least TWO supplied later frames whose ball centers are progressively closer to the top edge.
Ignore the player's knees, hips, torso, deepest knee flexion, body depth, and percentages of clip duration.
Do not select a later pause near the forehead, Set Point, or release.
Return ONLY JSON {"indices":[dipIndex]} with exactly one numeric integer, using the 0-based image labels.
If the ball or subsequent upward movement cannot be distinguished, return {"indices":[]} instead of guessing.`;

/** Backward-compatible export for probes that still compare the old combined contract. */
export const FRAME_SELECTION_PROMPT = SET_RELEASE_SELECTION_PROMPT;

export const LOCATE_SHOT_PROMPT = `These are coarse, explicitly labeled chronological video frames.
Locate the first complete basketball shot: choose the frame nearest the ball at the forehead or release.
This is only a coarse localization, NOT final phase selection.
Return ONLY JSON {"indices":[shotIndex]}, one numeric integer matching a supplied 0-based label.
If no shot is visible, return {"indices":[]}.`;

export function rhythmShotContext(indices: number[], timestamps: number[]) {
  return `Analyze ONLY the selected same shot: Dip index=${indices[0]} @ ${timestamps[indices[0]]}ms; Set Point index=${indices[1]} @ ${timestamps[indices[1]]}ms (loaded roughly-90-degree elbow before extension); Release index=${indices[2]} @ ${timestamps[indices[2]]}ms (earliest clear ball separation with extended arm and snapped wrist). Return these phase indices unchanged. Use preceding frames only to establish the rise leading into THIS shot; ignore any other shot. If rise timing cannot be identified, use -1 rather than choosing another shot.`;
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

export function validateSetReleaseIndices(indices: number[]) {
  if (indices.length !== 2 || indices[0] < 2) {
    throw new Error("Set Point must leave at least two earlier frames for Dip motion evidence");
  }
}

export function validateDipBeforeSetPoint(indices: number[], setPointIndex: number) {
  if (indices.length !== 1 || indices[0] > setPointIndex - 2) {
    throw new Error("Dip must be followed by at least two supplied frames before or at Set Point");
  }
}

export function labeledImages(frames: string[], timestamps: number[], mimeType: string) {
  return frames.flatMap((b64, index) => [
    { type: "text" as const, text: `IMAGE index=${index}; original video timestamp=${timestamps[index]}ms. The next image has this label.` },
    { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${b64}`, detail: "high" as const } },
  ]);
}

export async function verifyRelease(
  frames: string[],
  timestamps: number[],
  mimeType: string,
  setPointIdx: number,
  proposedReleaseIdx: number,
  request: (messages: ReturnType<typeof labeledImages>, correction: string | undefined, jsonMode: boolean) =>
    Promise<{ raw: string; finish?: string }>,
  diagnostic: (event: { attempt: number; raw: string; finish?: string; validation?: string }) => void,
): Promise<number> {
  const firstAfterSetPoint = setPointIdx + 1;
  // Examine the first release transition, not a later rebound/return in the
  // same clip. Allow four later 100ms samples to correct an early contact pick.
  const end = Math.min(frames.length, proposedReleaseIdx + 5);
  const releaseFrames = frames.slice(firstAfterSetPoint, end);
  if (!releaseFrames.length || proposedReleaseIdx <= setPointIdx ||
      proposedReleaseIdx >= frames.length || timestamps.length !== frames.length) throw new FrameSelectionError();
  const releaseMessages = labeledImages(releaseFrames, timestamps.slice(firstAfterSetPoint, end), mimeType);
  const [offset] = await selectWithCorrection(releaseFrames.length, 1,
    (correction, jsonMode) => request(releaseMessages, correction, jsonMode),
    diagnostic,
    "release");
  return firstAfterSetPoint + offset;
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
  labels = expected === 3 ? "dip,setPoint,release" : expected === 2 ? "setPoint,release" : "shot",
  validate?: (indices: number[]) => void,
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
      validate?.(indices);
      diagnostic({ attempt, raw: safeSelectionDiagnostic(result.raw), finish: result.finish });
      return indices;
    } catch (error) {
      const validation = (error as Error).message;
      diagnostic({ attempt, raw: safeSelectionDiagnostic(result.raw), finish: result.finish, validation });
      correction = `Previous response was invalid: ${validation}. Reinspect the labeled images. Return exactly {"indices":[${labels}]} with ${expected} increasing integers in [0,${count - 1}]. If the phases are not visible return an empty indices array; never invent phases.`;
    }
  }
  throw new FrameSelectionError();
}