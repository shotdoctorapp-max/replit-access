import { FrameSelectionError, parseIndices } from "./frameSelection";

export const PREPARE_RELEASE_PROMPT = `Find the first shooting action, not a rebound or ball return.
Return {"indices":[setPoint,releaseAnchor]}. Set Point is the loaded ball support before final extension.
releaseAnchor is the first approximate shooting-release transition after Set Point. It is only a search
anchor for a later 33ms sampling pass, NOT a verified Release thumbnail. Do not require a visible wrist
flick in this coarse sequence. Do not use clip percentages. Return {"indices":[]} if no shot is identifiable.`;

export const REFINE_RELEASE_PROMPT = `These high-detail images are a short chronological 33ms window
around ONE shooting action. Return {"indices":[index]} for the FIRST supplied image where the ball
has visibly left the shooting fingertips AND the shooting wrist is flexed downward, fingers pointing down.
An extending arm with fingertip contact is not sufficient. Ignore later rebounds or ball returns.
Return {"indices":[]} if the wrist or separation cannot be seen. Never invent an index.`;

export function validateRefinedRelease(raw: string, finish: string | null | undefined, count: number) {
  try {
    if (finish !== "stop") throw new Error("Incomplete response");
    return parseIndices(raw, count, 1)[0];
  } catch {
    throw new FrameSelectionError();
  }
}
