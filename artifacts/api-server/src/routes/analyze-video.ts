import { Router } from "express";
import { requireAuth } from "@clerk/express";
import { batchProcess, openrouter } from "@workspace/integrations-openrouter-ai";
import { BIOMECHANICS_SYSTEM_PROMPT, RHYTHM_SYSTEM_PROMPT } from "../lib/prompts";
import { analysisRateLimit } from "../middlewares/analysisRateLimit";
import { calculateShotScore, reliableRhythm, ScoringEvidenceError } from "../lib/scoring";
import { DIP_SELECTION_PROMPT, LOCATE_SHOT_PROMPT, SET_RELEASE_SELECTION_PROMPT, FrameSelectionError, labeledImages, selectWithCorrection, rhythmShotContext, providerFailure, validateDipBeforeSetPoint, validateSetReleaseIndices, verifyRelease } from "../lib/frameSelection";

const router = Router();
const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL ?? "google/gemini-2.5-flash";

router.post("/analyze-video", requireAuth(), analysisRateLimit, async (req, res) => {
  let providerCostUsd = 0;
  const recordCost = (response: unknown) => {
    const cost = (response as { usage?: { cost?: unknown } | null })?.usage?.cost;
    if (typeof cost === "number" && Number.isFinite(cost)) providerCostUsd += cost;
  };
  try {
    const { frames, timestamps, mode = "analyze", mimeType = "image/jpeg" } = req.body as {
      frames: string[];
      timestamps?: number[];
      mimeType?: string;
      mode?: "locate" | "analyze";
    };

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ error: "frames array is required" });
      return;
    }

    // Application bounds, not an asserted provider image limit.
    if (frames.length > 48 || (frames.length > 1 && frames.length < 3) ||
        frames.some(f => typeof f !== "string" || !f || f.length > 400_000) ||
        frames.reduce((sum, f) => sum + f.length, 0) > 10_000_000 ||
        !["image/jpeg", "image/png"].includes(mimeType) ||
        !["locate", "analyze"].includes(mode)) {
      res.status(400).json({ error: "Supply 3–48 bounded JPEG/PNG frames (or one photo), maximum 10 MB total." });
      return;
    }
    if (!Array.isArray(timestamps) || timestamps.length !== frames.length ||
        timestamps.some((t, i) => !Number.isFinite(t) || t < 0 || (i > 0 && t <= timestamps[i - 1]))) {
      res.status(400).json({ error: "Provide one strictly increasing original-video timestamp in milliseconds per frame." });
      return;
    }
    if ((mode === "locate" && frames.length > 32) ||
        (mode === "analyze" && frames.length > 1 &&
          timestamps.some((t, i) => i > 0 && Math.abs(t - timestamps[i - 1] - 100) > 1))) {
      res.status(400).json({ error: "Final phase selection requires consecutive 100ms samples. Use locate mode for a coarse shot window first." });
      return;
    }

    let indices = [0];
    if (frames.length > 1 && mode === "locate") {
      const labeledFrameMessages = labeledImages(frames, timestamps, mimeType);
      indices = await selectWithCorrection(frames.length, 1,
        async (correction, jsonMode) => {
          const [response] = await batchProcess([0], () => openrouter.chat.completions.create({
            model: ANALYSIS_MODEL,
            max_tokens: 8192,
            temperature: 0,
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            messages: [
              { role: "system", content: LOCATE_SHOT_PROMPT },
              { role: "user", content: labeledFrameMessages },
              ...(correction ? [{ role: "user" as const, content: correction }] : []),
            ],
          }, { maxRetries: 0, timeout: 90_000 }),
          { concurrency: 1, retries: 2, minTimeout: 2000, maxTimeout: 12000 });
          recordCost(response);
          return { raw: response.choices[0]?.message.content ?? "", finish: response.choices[0]?.finish_reason };
        },
        event => req.log.info(event, "Frame selection response"));
    }
    if (mode === "locate") {
      req.log.info({ model: ANALYSIS_MODEL, providerCostUsd }, "Analysis provider cost");
      res.json({ shotIndex: indices[0], shotTimestamp: timestamps[indices[0]], totalFrames: frames.length });
      return;
    }
    if (frames.length > 1) {
      const labeledFrameMessages = labeledImages(frames, timestamps, mimeType);
      const setReleaseIndices = await selectWithCorrection(frames.length, 2,
        async (correction, jsonMode) => {
          const [response] = await batchProcess([0], () => openrouter.chat.completions.create({
            model: ANALYSIS_MODEL,
            max_tokens: 8192,
            temperature: 0,
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            messages: [
              { role: "system", content: SET_RELEASE_SELECTION_PROMPT },
              { role: "user", content: labeledFrameMessages },
              ...(correction ? [{ role: "user" as const, content: correction }] : []),
            ],
          }, { maxRetries: 0, timeout: 90_000 }),
          { concurrency: 1, retries: 2, minTimeout: 2000, maxTimeout: 12000 });
          recordCost(response);
          return { raw: response.choices[0]?.message.content ?? "", finish: response.choices[0]?.finish_reason };
        },
        event => req.log.info(event, "Set Point/Release selection response"),
        "setPoint,release",
        validateSetReleaseIndices);
      const [setPointIdx, proposedReleaseIdx] = setReleaseIndices;
      // The first pass only proposes Release. Independently review the actual
      // supplied samples after Set Point; syntactically valid contact is not Release.
      const releaseIdx = await verifyRelease(frames, timestamps, mimeType, setPointIdx, proposedReleaseIdx,
        async (releaseMessages, correction, jsonMode, prompt) => {
          const [response] = await batchProcess([0], () => openrouter.chat.completions.create({
            model: ANALYSIS_MODEL,
            max_tokens: 8192,
            temperature: 0,
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: releaseMessages },
              ...(correction ? [{ role: "user" as const, content: correction }] : []),
            ],
          }, { maxRetries: 0, timeout: 90_000 }),
          { concurrency: 1, retries: 2, minTimeout: 2000, maxTimeout: 12000 });
          recordCost(response);
          return { raw: response.choices[0]?.message.content ?? "", finish: response.choices[0]?.finish_reason };
        },
        event => req.log.info(event, "Release verification response"));
      const dipFrameCount = setPointIdx + 1;
      const dipFrameMessages = labeledImages(
        frames.slice(0, dipFrameCount),
        timestamps.slice(0, dipFrameCount),
        mimeType,
      );
      const [dipIdx] = await selectWithCorrection(dipFrameCount, 1,
        async (correction, jsonMode) => {
          const [response] = await batchProcess([0], () => openrouter.chat.completions.create({
            model: ANALYSIS_MODEL,
            max_tokens: 8192,
            temperature: 0,
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            messages: [
              { role: "system", content: DIP_SELECTION_PROMPT },
              { role: "user", content: dipFrameMessages },
              ...(correction ? [{ role: "user" as const, content: correction }] : []),
            ],
          }, { maxRetries: 0, timeout: 90_000 }),
          { concurrency: 1, retries: 2, minTimeout: 2000, maxTimeout: 12000 });
          recordCost(response);
          return { raw: response.choices[0]?.message.content ?? "", finish: response.choices[0]?.finish_reason };
        },
        event => req.log.info(event, "Dip selection response"),
        "dip",
        selected => validateDipBeforeSetPoint(selected, setPointIdx));
      indices = [dipIdx, setPointIdx, releaseIdx];
    }
    const [dipIdx, setPointIdx = 0, releaseIdx = 0] = indices;
    const labeledFrameMessages = labeledImages(frames, timestamps, mimeType);
    const bestFrameIndex = setPointIdx;

    // Rhythm is separate from selection: it cannot replace the validated phases.
    const stepOneJobs = [
      ...(frames.length >= 3 ? ["rhythm" as const] : []),
    ];
    const stepOneResults = await batchProcess(
      stepOneJobs,
      async (job) => {
        const response = await openrouter.chat.completions.create({
          model: ANALYSIS_MODEL,
          max_tokens: 8192,
          temperature: 0,
          messages: [
            { role: "system", content: RHYTHM_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                ...labeledFrameMessages,
                {
                  type: "text" as const,
                  text: `${rhythmShotContext(indices, timestamps)} Analyze the temporal motion sequence to determine the shot rhythm pattern. Look specifically for: when does the body/legs drive up vs when does the ball rise (body-first = good kinetic chain). Return ONLY valid JSON.`,
                },
              ],
            },
          ],
        });
        recordCost(response);
        return {
          job,
          response,
        };
      },
      { concurrency: 1, retries: 3, minTimeout: 1000, maxTimeout: 12000 }
    );
    const rhythmResult = stepOneResults.find((result) => result.job === "rhythm")?.response ?? null;

    // Parse rhythm
    let rhythm: { dipFrame?: number; setPointFrame?: number; armExtendFrame?: number; ballRiseFrame?: number; bodyRiseFrame?: number; pattern?: string; rhythmScore?: number; observations?: string[] } | null = null;
    if (rhythmResult) {
      const rhythmContent = rhythmResult.choices[0]?.message?.content ?? "{}";
      try {
        const jsonMatch = rhythmContent.match(/\{[\s\S]*\}/);
        rhythm = JSON.parse(jsonMatch ? jsonMatch[0] : rhythmContent);
      } catch {
        req.log.warn("Failed to parse rhythm analysis");
      }
    }

    const rhythmReliable = reliableRhythm(rhythm, indices);
    // Phase selection, never rhythm percentages, owns all displayed/annotated indices.
    if (rhythm && frames.length > 1) {
      rhythm.dipFrame = dipIdx;
      rhythm.setPointFrame = setPointIdx;
      rhythm.armExtendFrame = releaseIdx;
    }
    req.log.info({ bestFrameIndex, dipIdx, setPointIdx, releaseIdx }, "Step 2: running biomechanics with 3 key frames");

    // Build biomechanics prompt with all 3 key frames for annotation accuracy
    const isVideoSession = frames.length > 1;
    const biomechanicsUserContent: Array<
      | { type: "image_url"; image_url: { url: string; detail: "high" | "low" } }
      | { type: "text"; text: string }
    > = [];

    if (isVideoSession) {
      biomechanicsUserContent.push(
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[bestFrameIndex]}`, detail: "high" },
        },
        {
          type: "text",
          text: `SET POINT OVERVIEW: original index=${bestFrameIndex}, timestamp=${timestamps[bestFrameIndex]}ms. Do not score all mechanics from this image alone. Use the labeled Dip image for stance/hipAlignment/balance, Set Point for elbowPosition/gripPosition/setPoint, and Release for followThrough/eyeTracking. Compare phases only where motion is actually visible. Never infer hidden feet, fingertip contact, gaze, ball spin, shot outcome, or repeatability from one static view. Use score:null for any component that cannot be assessed from the supplied evidence.`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[dipIdx]}`, detail: "high" },
        },
        {
          type: "text",
          text: `KEY FRAME — frameIndex: 0 (Dip phase, supplied image ${dipIdx}/${frames.length - 1} @ original-video ${timestamps[dipIdx]}ms). Place annotations with frameIndex 0 at the exact body-part positions visible in THIS image. Use for: stance (feet), hipAlignment (hips), balance (whole body center of mass).`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[setPointIdx]}`, detail: "high" },
        },
        {
          type: "text",
          text: `KEY FRAME — frameIndex: 1 (Set Point phase, supplied image ${setPointIdx}/${frames.length - 1} @ original-video ${timestamps[setPointIdx]}ms). Place annotations with frameIndex 1 at the exact body-part positions visible in THIS image. Use for: elbowPosition (shooting elbow), gripPosition (shooting hand/wrist), setPoint (ball position at ear/eyebrow).`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[releaseIdx]}`, detail: "high" },
        },
        {
          type: "text",
          text: `KEY FRAME — frameIndex: 2 (Release phase, supplied image ${releaseIdx}/${frames.length - 1} @ original-video ${timestamps[releaseIdx]}ms). Place annotations with frameIndex 2 at the exact body-part positions visible in THIS image. Use for: followThrough (shooting wrist/arm finish), eyeTracking (eyes/head direction).`,
        },
      );

      // Inject rhythm context so the biomechanics summary can reference it
      if (rhythmReliable && rhythm) {
        biomechanicsUserContent.push({
          type: "text",
          text: `RHYTHM CONTEXT: This shooter's rhythm was also analyzed separately. rhythmScore: ${rhythm.rhythmScore}/100, pattern: "${rhythm.pattern}". If rhythmScore < 70, mention rhythm in your summary as a factor dragging down the overall score.`,
        });
      }

      biomechanicsUserContent.push({
        type: "text",
        text: "Return ONLY valid JSON as specified. CRITICAL for annotations: use the exact pixel coordinates from each labeled KEY FRAME image — do NOT guess positions. frameIndex 0 = Dip image, frameIndex 1 = Set Point image, frameIndex 2 = Release image.",
      });
    } else {
      biomechanicsUserContent.push(
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[0]}`, detail: "high" },
        },
        {
          type: "text",
          text: "Evaluate only mechanics directly visible in this basketball photo. A photo cannot establish unseen motion, spin, gaze, release consistency or shot outcome. Set score:null for any component not assessable from this view; do not fill missing evidence with an average score.",
        },
        {
          type: "text",
          text: "Return ONLY valid JSON as specified. Use frameIndex 0 for all annotations.",
        }
      );
    }

    const [analysisResponse] = await batchProcess(
      [biomechanicsUserContent],
      async (content) => {
        const response = await openrouter.chat.completions.create({
          model: ANALYSIS_MODEL,
          max_tokens: 8192,
          temperature: 0,
          messages: [
            { role: "system", content: BIOMECHANICS_SYSTEM_PROMPT },
            { role: "user", content },
          ],
        });
        recordCost(response);
        return response;
      },
      { concurrency: 1, retries: 3, minTimeout: 1000, maxTimeout: 12000 }
    );

    // Parse biomechanics
    const content = analysisResponse.choices[0]?.message?.content ?? "{}";
    let analysis;
    try {
      if (analysisResponse.choices[0]?.finish_reason !== "stop") throw new Error("Incomplete analysis");
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      req.log.error("Failed to parse biomechanics JSON");
      res.status(500).json({ error: "Failed to parse analysis response" });
      return;
    }

    req.log.info(
      { rhythmReliable, dipFrame: rhythm?.dipFrame, armExtendFrame: rhythm?.armExtendFrame, rhythmScore: rhythm?.rhythmScore },
      "Rhythm reliability check"
    );

    const score = calculateShotScore(analysis?.components, rhythmReliable ? rhythm!.rhythmScore : null);
    req.log.info({ ...score, modelOverallScore: typeof analysis.overallScore === "number" ? analysis.overallScore : null,
      rhythmIncluded: rhythmReliable }, "Evidence-based score calculation");
    analysis.overallScore = score.overallScore;

    req.log.info({ model: ANALYSIS_MODEL, providerCostUsd }, "Analysis provider cost");
    res.json({
      analysis,
      rhythm: rhythmReliable ? rhythm : null,
      bestFrameIndex,
      totalFrames: frames.length,
      timestamp: new Date().toISOString(),
      keyFrameIndices: isVideoSession ? [dipIdx, setPointIdx, releaseIdx] : [0],
      keyFrameTimestamps: indices.map(i => timestamps[i]),
    });
  } catch (err) {
    req.log.warn({ model: ANALYSIS_MODEL, providerCostUsd }, "Partial analysis provider cost");
    if (err instanceof ScoringEvidenceError) {
      res.status(422).json({ error: err.message, code: "SCORING_EVIDENCE_INSUFFICIENT", retryable: false });
      return;
    }
    if (err instanceof FrameSelectionError) {
      res.status(422).json({ error: err.message, code: "FRAME_SELECTION_UNCERTAIN", retryable: true });
      return;
    }
    const status = (err as { status?: number })?.status;
    req.log.error({ status }, "Video analysis provider request failed");
    const failure = providerFailure(err);
    res.status(failure.status).json(failure.body);
  }
});

export default router;
