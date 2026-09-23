import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { DIP_SELECTION_PROMPT, FrameSelectionError, labeledImages, parseIndices, safeSelectionDiagnostic, selectWithCorrection, providerFailure, rhythmShotContext, validateDipBeforeSetPoint, validateSetReleaseIndices } from "../../artifacts/api-server/src/lib/frameSelection";
import { RHYTHM_SYSTEM_PROMPT } from "../../artifacts/api-server/src/lib/prompts";
import { MAX_SELECTION_IMAGES, planFrameTimes, validateFrameMapping } from "../../artifacts/mobile/utils/frameSampling";

test("historical heuristic demonstrably replaces late valid dip, accepts fractions and duplicates", () => {
  const old = execFileSync("git", ["show", "49bb3ae:artifacts/api-server/src/routes/analyze-video.ts"], { encoding: "utf8" });
  const source = old.slice(old.indexOf("function selectKeyFrameIndices("), old.indexOf('router.post("/analyze-video"'));
  const javascript = ts.transpile(source);
  const oldSelect = runInNewContext(`${javascript}; selectKeyFrameIndices`);
  assert.equal(oldSelect(12, { dipFrame: 6, setPointFrame: 8, armExtendFrame: 9 }, 8).dipIdx, 4);
  assert.equal(oldSelect(12, { dipFrame: 1.5, setPointFrame: 6, armExtendFrame: 9 }, 6).dipIdx, 1.5);
  const duplicate = oldSelect(12, null, 11);
  assert.equal(duplicate.setPointIdx, 11);
  assert.equal(duplicate.releaseIdx, 11);
  // New contract preserves late valid phases and refuses both other cases.
  assert.deepEqual(parseIndices('{"indices":[6,8,9]}', 12), [6, 8, 9]);
  assert.throws(() => parseIndices('{"indices":[1.5,6,9]}', 12));
  assert.throws(() => parseIndices('{"indices":[7,11,11]}', 12));
});

test("rhythm uses selected same-shot indices and release means last contact, not extension onset", () => {
  const context = rhythmShotContext([1, 3, 4], [5000, 5100, 5200, 5300, 5400]);
  assert.match(context, /Dip index=1 @ 5100ms/);
  assert.match(context, /Set Point index=3 @ 5300ms/);
  assert.match(context, /Release index=4 @ 5400ms/);
  assert.match(context, /ignore any other shot/);
  assert.match(RHYTHM_SYSTEM_PROMPT, /LAST frame where fingertips still contact/);
  assert.doesNotMatch(RHYTHM_SYSTEM_PROMPT, /When does the shooting arm begin its final extension/);
});

test("daily quota, transient rate limit and uncertain clip have distinct safe messages", () => {
  const daily = providerFailure({ status: 429, message: "429 Rate limit exceeded: free-models-per-day-high-balance." });
  assert.equal(daily.status, 429);
  assert.equal(daily.body.code, "PROVIDER_DAILY_QUOTA");
  assert.match(daily.body.error, /daily quota is exhausted/);
  assert.match(daily.body.error, /not a problem with your clip/);
  assert.match(daily.body.error, /quota resets/);
  const temporary = providerFailure({ status: 429, message: "Rate limit exceeded per minute" });
  assert.equal(temporary.body.code, "PROVIDER_RATE_LIMIT");
  assert.doesNotMatch(temporary.body.error, /daily/);
  assert.match(temporary.body.error, /service is busy/);
  assert.equal(providerFailure({ status: 400, message: "invalid image" }).status, 502);
  assert.match(new FrameSelectionError().message, /short, clear clip/);
});

test("strict integers, order and exact cardinality; accepts JSON and single complete fence", () => {
  for (const raw of ['{"indices":[0,1,4]}', '```json\n{"indices":[0,1,4]}\n```']) {
    assert.deepEqual(parseIndices(raw, 5), [0, 1, 4]);
  }
  for (const indices of [[0, 1], [0, 1, 2, 3], [0, 0, 2], [3, 2, 1], [-1, 1, 2], [0, 1, 5], [0, 1.5, 2], ["0", 1, 2], [null, 1, 2]]) {
    assert.throws(() => parseIndices(JSON.stringify({ indices }), 5));
  }
  for (const raw of ["", "{}", "null", "[]", "text {\"indices\":[0,1,2]}", '{"indices":[0,1,2]} {}',
    '{"indices":[0,1,2],"reason":"guess"}', '{"indices":[0,1,NaN]}']) assert.throws(() => parseIndices(raw, 5));
  assert.deepEqual(parseIndices('{"indices":[4]}', 5, 1), [4]);
});

test("bounded correction retry returns only validated response", async () => {
  const corrections: (string | undefined)[] = [];
  const logs: unknown[] = [];
  const indices = await selectWithCorrection(5, 3, async correction => {
    corrections.push(correction);
    return { raw: corrections.length === 1 ? '{"indices":[2,2,4]}' : '{"indices":[1,3,4]}', finish: "stop" };
  }, e => logs.push(e));
  assert.deepEqual(indices, [1, 3, 4]);
  assert.equal(corrections[0], undefined);
  assert.match(corrections[1]!, /Previous response was invalid/);
  assert.equal(logs.length, 2);
});

test("Dip is ball-position only and requires two later frames of upward-motion evidence", async () => {
  assert.match(DIP_SELECTION_PROMPT, /defined ONLY by BALL POSITION/);
  assert.match(DIP_SELECTION_PROMPT, /CENTER of the ball/);
  assert.match(DIP_SELECTION_PROMPT, /closer to the BOTTOM image edge/);
  assert.match(DIP_SELECTION_PROMPT, /at\s+least TWO supplied later frames/);
  assert.match(DIP_SELECTION_PROMPT, /deepest knee flexion/);
  assert.doesNotThrow(() => validateSetReleaseIndices([3, 4]));
  assert.throws(() => validateSetReleaseIndices([1, 4]), /two earlier frames/);
  assert.doesNotThrow(() => validateDipBeforeSetPoint([2], 4));
  assert.throws(() => validateDipBeforeSetPoint([3], 4), /two supplied frames/);

  const corrections: (string | undefined)[] = [];
  const dip = await selectWithCorrection(5, 1, async correction => {
    corrections.push(correction);
    return { raw: corrections.length === 1 ? '{"indices":[3]}' : '{"indices":[2]}', finish: "stop" };
  }, () => {}, "dip", indices => validateDipBeforeSetPoint(indices, 4));
  assert.deepEqual(dip, [2]);
  assert.match(corrections[1]!, /Dip must be followed/);
  assert.match(corrections[1]!, /"indices":\[dip\]/);
});

test("exhaustion and truncation never invent successful indices", async () => {
  for (const result of [{ raw: '{"indices":[]}', finish: "stop" }, { raw: '{"indices":[0,1,2]}', finish: "length" }]) {
    let calls = 0;
    await assert.rejects(selectWithCorrection(5, 3, async () => { calls++; return result; }, () => {}), FrameSelectionError);
    assert.equal(calls, 3);
  }
});

test("only explicit unsupported JSON format errors disable JSON mode", async () => {
  const modes: boolean[] = [];
  const result = await selectWithCorrection(5, 3, async (_, mode) => {
    modes.push(mode);
    if (mode) throw { status: 400, message: "response_format json_object is not supported" };
    return { raw: '{"indices":[0,1,2]}', finish: "stop" };
  }, () => {});
  assert.deepEqual(modes, [true, false]);
  assert.deepEqual(result, [0, 1, 2]);
  for (const error of [{ status: 429, message: "quota" }, { status: 400, message: "Too many images" }, { status: 500, message: "response_format not supported" }]) {
    let calls = 0;
    await assert.rejects(selectWithCorrection(5, 3, async () => { calls++; throw error; }, () => {}));
    assert.equal(calls, 1);
  }
});

test("images have preceding exact index and original timestamp; diagnostics redact PII", () => {
  const content = labeledImages(["AA", "BB"], [4200, 4300], "image/jpeg");
  assert.match((content[0] as { text: string }).text, /index=0; original video timestamp=4200ms/);
  assert.equal((content[1] as { image_url: { url: string } }).image_url.url, "data:image/jpeg;base64,AA");
  assert.match((content[2] as { text: string }).text, /index=1; original video timestamp=4300ms/);
  assert.equal(safeSelectionDiagnostic('{"indices":[0,1,2]}'), '{"indices":[0,1,2]}');
  const log = safeSelectionDiagnostic("Jane Doe jane@example.com https://private.example data:image/jpeg;base64,AAA 15551234567");
  assert.doesNotMatch(log, /Jane|Doe|example|private|AAA|15551234567/);
  assert.ok(safeSelectionDiagnostic("x".repeat(5000)).length < 600);
});

test("sampling is bounded, dense, EOF-safe, with traceable long-clip refinement", () => {
  for (const duration of [300, 1579, 4700, 4750, 9961, 30000, 30001, 59999, 60000]) {
    const plan = planFrameTimes(duration);
    assert.ok(plan.timestamps.length <= MAX_SELECTION_IMAGES);
    assert.ok(plan.timestamps.at(-1)! < duration);
    for (const anchor of [plan.timestamps[0], plan.timestamps.at(-1)!]) {
      const dense = planFrameTimes(duration, anchor);
      assert.equal(dense.coarse, false);
      assert.ok(dense.timestamps.length <= MAX_SELECTION_IMAGES);
      assert.ok(dense.timestamps.every((t, i) => t >= 0 && t < duration && (i === 0 || t - dense.timestamps[i - 1] === 100)));
    }
  }
  assert.equal(planFrameTimes(9961).coarse, true);
  assert.equal(planFrameTimes(1579).coarse, false);
  assert.deepEqual(planFrameTimes(1579).timestamps, Array.from({ length: 16 }, (_, i) => i * 100));
  for (const duration of [NaN, Infinity, 0, 200, 60001]) assert.throws(() => planFrameTimes(duration));
  assert.throws(() => planFrameTimes(9000, -1));
});

test("client validates exactly the final sequence; offset timestamps persist without remapping", () => {
  const timestamps = [5000, 5100, 5200, 5300, 5400];
  const uris = ["a", "b", "c", "d", "e"];
  const indices = validateFrameMapping([0, 2, 4], [5000, 5200, 5400], 5, timestamps, uris);
  const persisted = JSON.parse(JSON.stringify({ keyFrameIndices: indices, keyFrameTimestamps: indices.map(i => timestamps[i]), keyFrameUris: indices.map(i => uris[i]), sampledTimestamps: timestamps }));
  assert.deepEqual(persisted.keyFrameUris, ["a", "c", "e"]);
  assert.deepEqual(persisted.keyFrameTimestamps, [5000, 5200, 5400]);
  for (const bad of [[0, 0, 2], [0, 1.5, 2], [0, 1, 5], undefined, [0, 1]]) {
    assert.throws(() => validateFrameMapping(bad, [5000, 5200, 5400], 5, timestamps, uris));
  }
  assert.throws(() => validateFrameMapping(indices, [0, 200, 400], 5, timestamps, uris));
  assert.throws(() => validateFrameMapping(indices, [5000, 5200, 5400], 4, timestamps, uris));
  assert.throws(() => validateFrameMapping(indices, [5000, 5200, 5400], 5, timestamps, ["a", "b", "", "d", "e"]));
});