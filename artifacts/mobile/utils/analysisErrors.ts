export const ANALYSIS_FAILURE_MESSAGE =
  "We couldn't analyze this video. Please try again.";

export const SIGNED_OUT_MESSAGE =
  "Your sign-in expired. Please sign in again and retry. Your shot was not used.";

// Server-written messages for these codes are meant for users and say what to do.
const USER_FACING_CODES = new Set([
  "ANALYSIS_RATE_LIMIT",
  "PROVIDER_RATE_LIMIT",
  "PROVIDER_DAILY_QUOTA",
]);

export function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorStatus(error: unknown): number | undefined {
  return isObject(error) && "status" in error && typeof error.status === "number" ? error.status : undefined;
}

function errorData(error: unknown): { code?: string; error?: string } {
  if (!isObject(error) || !("data" in error) || !isObject(error.data)) return {};
  const data = error.data as Record<string, unknown>;
  return {
    code: typeof data.code === "string" ? data.code : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

/**
 * Short, non-sensitive reference shown after the generic message so a failure
 * report from a user (or a screenshot) says which step failed, without
 * exposing raw engine, provider or proxy text.
 */
export function analysisErrorReference(error: unknown): string {
  const status = errorStatus(error);
  const { code } = errorData(error);
  const name = error instanceof Error ? error.name : typeof error;
  return [status ? `HTTP ${status}` : name, code].filter(Boolean).join(" ");
}

export function analysisErrorMessage(error: unknown): string {
  // Only explicitly identified, user-actionable failures may bypass the generic
  // message. Never display arbitrary engine, provider or proxy response text.
  const status = errorStatus(error);
  const { code, error: serverMessage } = errorData(error);
  if (status === 401 || status === 403 || code === "AUTH_REQUIRED") {
    return SIGNED_OUT_MESSAGE;
  }
  if (code && USER_FACING_CODES.has(code) && serverMessage) {
    return serverMessage;
  }
  if (error instanceof Error && !(error instanceof TypeError)) {
    if (/iCloud|PHPhotosErrorDomain|3164/.test(error.message)) {
      return "This video hasn't been downloaded from iCloud yet. Open it in Photos to download it, then try again.";
    }
    if (code === "SCORING_EVIDENCE_INSUFFICIENT") {
      return "We couldn't find visible shooting mechanics to grade. Record one person taking a shot and try again.";
    }
  }
  return `${ANALYSIS_FAILURE_MESSAGE}\n\n(ref: ${analysisErrorReference(error)})`;
}
