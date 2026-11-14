import assert from "node:assert/strict";
import test from "node:test";
import { customFetch, ApiError, ResponseParseError } from "../../lib/api-client-react/src/custom-fetch";
import { videoSuccess } from "../../artifacts/api-server/src/lib/videoResponse";
import { AnalyzeFormResponse } from "../../lib/api-zod/src/generated/api";
import { analysisErrorMessage, ANALYSIS_FAILURE_MESSAGE, isObject } from "../../artifacts/mobile/utils/analysisErrors";

test("analysis transport validates native response bodies before any in operator", async () => {
  const originalFetch = globalThis.fetch;
  const endpoint = "https://example.test/api/analyze-video";
  const payload = { keyFrameIndices: [0, 1, 2], keyFrameTimestamps: [0, 100, 200], totalFrames: 3 };
  function reply(body: string, contentType?: string, status = 200, streamBody: null | undefined = undefined) {
    // RN's fetch exposes no ReadableStream body, but text() contains the payload.
    globalThis.fetch = async () => ({
      ok: status >= 200 && status < 300, status, statusText: "Test",
      headers: new Headers(contentType ? { "content-type": contentType } : {}),
      body: streamBody, text: async () => body,
    }) as Response;
  }
  try {
    for (const contentType of ["application/json", "text/plain", undefined]) {
      for (const streamBody of [null, undefined]) {
        reply(JSON.stringify(payload), contentType, 200, streamBody);
        const result = await customFetch(endpoint, { method: "POST" });
        assert(isObject(result));
        assert("keyFrameIndices" in result);
        assert.deepEqual(result, payload);
      }
    }
    for (const malformed of ["null", "7", "true", '"text"', '[]', '""', "", "<html>Sign in</html>", JSON.stringify(JSON.stringify(payload))]) {
      reply(malformed, "application/json");
      await assert.rejects(customFetch(endpoint, { method: "POST" }), ResponseParseError);
    }
    reply(JSON.stringify({ ok: false, error: "Internal engine error" }), "application/json", 500);
    await assert.rejects(customFetch(endpoint), (error: unknown) => {
      assert(error instanceof ApiError);
      assert.equal(error.status, 500);
      assert.equal(analysisErrorMessage(error), ANALYSIS_FAILURE_MESSAGE);
      return true;
    });
    reply(JSON.stringify({ ok: false, error: "Server failed despite HTTP 200" }), "application/json");
    await assert.rejects(customFetch(endpoint), ApiError);
    // Non-analysis text endpoints retain their original behavior.
    reply("Confirmed", "text/html");
    assert.equal(await customFetch("https://example.test/api/waitlist/confirm"), "Confirmed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("all phase modes have object envelopes without breaking installed clients", () => {
  const stages = [
    { shotIndex: 1, shotTimestamp: 100, totalFrames: 3 },
    { keyFrameIndices: [0, 1, 2], keyFrameTimestamps: [0, 100, 200], totalFrames: 3 },
    { releaseIndex: 1, releaseTimestamp: 133, totalFrames: 3 },
  ];
  for (const stage of stages) {
    const response = videoSuccess(stage);
    assert.equal(response.ok, true);
    assert.deepEqual(response.analysis, stage);
    for (const [key, value] of Object.entries(stage)) {
      assert.deepEqual(Reflect.get(response, key), value);
    }
  }
  assert.throws(() => videoSuccess({ releaseIndex: "1", totalFrames: 3 }));
});

test("final analysis preserves biomechanics, frame mapping and History input", () => {
  const component = { score: 80, feedback: "Visible mechanics" };
  const analysis = {
    overallScore: 80, summary: "Test fixture",
    components: Object.fromEntries(
      ["stance", "hipAlignment", "elbowPosition", "gripPosition", "setPoint", "followThrough", "balance", "eyeTracking"]
        .map(key => [key, component])),
    keyStrengths: [], priorityFixes: [], drillRecommendations: [],
  };
  const response = videoSuccess({
    analysis, rhythm: null, timestamp: "2026-11-13T00:00:00Z",
    confidence: "high",
    captureQuality: { issues: [], tips: [], assessedComponents: 8, totalComponents: 8 },
    bestFrameIndex: 1, totalFrames: 3,
    keyFrameIndices: [0, 1, 2], keyFrameTimestamps: [0, 100, 200],
  });
  assert("bestFrameIndex" in response);
  assert.deepEqual(response.analysis, analysis);
  assert.equal(response.bestFrameIndex, 1);
  assert.deepEqual(response.keyFrameTimestamps, [0, 100, 200]);
  for (const bad of [null, "{}", 1, [], { components: "invalid" }]) {
    assert.equal(AnalyzeFormResponse.shape.analysis.safeParse(bad).success, false);
  }
});

test("primitive inputs and unexpected engine/provider errors never reach the user", () => {
  for (const value of [null, undefined, false, 0, "text", []]) {
    assert.equal(isObject(value), false);
  }
  for (const error of [new TypeError("right operand of 'in' is not an object"), new Error("<html>Bad gateway</html>"), null]) {
    assert.equal(analysisErrorMessage(error), ANALYSIS_FAILURE_MESSAGE);
  }
  assert.match(analysisErrorMessage(new Error("PHPhotosErrorDomain 3164")), /downloaded from iCloud/);
});
