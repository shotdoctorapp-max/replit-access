import assert from "node:assert/strict";
import test from "node:test";
import { analysisErrorMessage, ANALYSIS_FAILURE_MESSAGE, SIGNED_OUT_MESSAGE } from "../../artifacts/mobile/utils/analysisErrors";

function apiError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { name: "ApiError", status, data });
}

test("expired sign-in tells the user to sign in again", () => {
  assert.equal(analysisErrorMessage(apiError(401, { ok: false, code: "AUTH_REQUIRED", error: "x" })), SIGNED_OUT_MESSAGE);
  assert.equal(analysisErrorMessage(apiError(403, null)), SIGNED_OUT_MESSAGE);
});

test("rate limits show the server's user-facing message", () => {
  const msg = "Analysis limit reached. You can analyze 20 videos per hour. Try again in 5 minute(s).";
  assert.equal(analysisErrorMessage(apiError(429, { ok: false, code: "ANALYSIS_RATE_LIMIT", error: msg })), msg);
});

test("generic failures carry a short reference but never raw text", () => {
  const message = analysisErrorMessage(apiError(502, { ok: false, code: "PROVIDER_ERROR", error: "<html>upstream</html>" }));
  assert(message.startsWith(ANALYSIS_FAILURE_MESSAGE));
  assert.match(message, /ref: HTTP 502 PROVIDER_ERROR/);
  assert(!message.includes("<html>"));
  const engine = analysisErrorMessage(new TypeError("right operand of 'in' is not an object"));
  assert(!engine.includes("operand"));
});
