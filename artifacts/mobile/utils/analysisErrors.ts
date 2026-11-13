export const ANALYSIS_FAILURE_MESSAGE =
  "We couldn't analyze this video. Please try again.";

export function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function analysisErrorMessage(error: unknown): string {
  // Only explicitly identified, user-actionable failures may bypass the generic
  // message. Never display arbitrary engine, provider or proxy response text.
  if (error instanceof Error && !(error instanceof TypeError)) {
    if (/iCloud|PHPhotosErrorDomain|3164/.test(error.message)) {
      return "This video hasn't been downloaded from iCloud yet. Open it in Photos to download it, then try again.";
    }
    if ("data" in error && isObject(error.data) && "code" in error.data &&
        ["SCORING_EVIDENCE_INSUFFICIENT", "FRAME_SELECTION_UNCERTAIN"].includes(String(error.data.code))) {
      return "We couldn't clearly assess the shot. Try a shorter clip with your full body and shooting hand visible.";
    }
  }
  return ANALYSIS_FAILURE_MESSAGE;
}
