import { Router } from "express";
import { z } from "zod";
import { AnalyzeFormResponse } from "@workspace/api-zod";
import { batchProcess, openrouter } from "@workspace/integrations-openrouter-ai";
import { BIOMECHANICS_SYSTEM_PROMPT, RHYTHM_SYSTEM_PROMPT } from "../lib/prompts";
import { analysisRateLimit } from "../middlewares/analysisRateLimit";
import { videoSuccess } from "../lib/videoResponse";
import { PREPARE_RELEASE_PROMPT, REFINE_RELEASE_PROMPT, validateRefinedRelease } from "../lib/releaseRefinement";
import { calculateShotScore, reliableRhythm, ScoringEvidenceError } from "../lib/scoring";
import { assessCaptureQuality, parsePartialAnalysis } from "../lib/partialAnalysis";
import { DIP_SELECTION_PROMPT, LOCATE_SHOT_PROMPT, SET_RELEASE_SELECTION_PROMPT, FrameSelectionError, labeledImages, selectWithCorrection, rhythmShotContext, providerFailure, validateDipBeforeSetPoint, validateSetReleaseIndices, verifyRelease } from "../lib/frameSelection";

const router = Router();
const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL ?? "google/gemini-2.5-flash";

// analysisRateLimit also verifies getAuth(req).userId and returns JSON 401.
// requireAuth() redirects browsers to an HTML sign-in page instead.
router.post("/analyze-video", analysisRateLimit, async (req, res) => {
  let providerCostUsd = 0;
  const recordCost = (response: unknown) => {
    const cost = (response as { usage?: { cost?: unknown } | null })?.usage?.cost;
    if (typeof cost === "number" && Number.isFinite(cost)) providerCostUsd += cost;
  };
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ ok: false, error: "Please supply video frames to analyze." });
      return;
    }
    const { frames, timestamps, mode = "analyze", mimeType = "image/jpeg", shootingHand, phaseIndices, availableEvidence = false } = req.body as {
      frames: string[];
      timestamps?: number[];
      mimeType?: string;
      mode?: "locate" | "analyze" | "prepare" | "refine-release";
      shootingHand?: "right" | "left";
      phaseIndices?: number[];
      availableEvidence?: boolean;
    };
    if (!["right", "left"].includes(shootingHand!)) {
      res.status(400).json({ ok: false, error: "Choose your shooting hand before analyzing." });
      return;
    }

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ ok: false, error: "frames array is required" });
      return;
    }

    // Application bounds, not an asserted provider image limit.
    if (frames.length > 48 || typeof availableEvidence !== "boolean" ||
        (availableEvidence && mode !== "analyze") ||
        (frames.length === 2 && !availableEvidence) ||
        (frames.length === 1 && mode !== "analyze") ||
        frames.some(f => typeof f !== "string" || !f || f.length > 400_000) ||
        frames.reduce((sum, f) => sum + f.length, 0) > 10_000_000 ||
        !["image/jpeg", "image/png"].includes(mimeType) ||
        !["locate", "analyze", "prepare", "refine-release"].includes(mode)) {
      res.status(400).json({ ok: false, error: "Supply 3–48 bounded JPEG/PNG frames (or one photo), maximum 10 MB total." });
      return;
    }
    if (!Array.isArray(timestamps) || timestamps.length !== frames.length ||
        timestamps.some((t, i) => !Number.isFinite(t) || t < 0 || (i > 0 && t <= timestamps[i - 1]))) {
      res.status(400).json({ ok: false, error: "Provide one strictly increasing original-video timestamp in milliseconds per frame." });
      return;
    }
    if ((mode === "locate" && frames.length > 32) ||
         ((mode === "prepare" || (mode === "analyze" && !phaseIndices && !availableEvidence)) && frames.length > 1 &&
          timestamps.some((t, i) => i > 0 && Math.abs(t - timestamps[i - 1] - 100) > 1))) {
      res.status(400).json({ ok: false, error: "Final phase selection requires consecutive 100ms samples. Use locate mode for a coarse shot window first." });
      return;
    }
    if (mode === "refine-release") {
      if (frames.length > 11 || frames.length < 3 ||
          timestamps.some((t, i) => i > 0 && Math.abs(t - timestamps[i - 1] - 33) > 1)) {
        res.status(400).json({ ok: false, error: "Supply 3–11 consecutive 33ms images around the release transition." });
        return;
      }
      const response = await openrouter.chat.completions.create({
        model: ANALYSIS_MODEL, temperature: 0, max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: REFINE_RELEASE_PROMPT + ` Declared shooting hand: ${shootingHand ?? "not supplied"}. Identify the hand behind/under the ball, not the guide hand at the side.` },
          { role: "user", content: labeledImages(frames, timestamps, mimeType) }],
      }, { maxRetries: 0, timeout: 90_000 });
      recordCost(response);
      const releaseIndex = validateRefinedRelease(response.choices[0]?.message.content ?? "",
        response.choices[0]?.finish_reason, frames.length);
      req.log.info({ releaseIndex, releaseTimestamp: timestamps[releaseIndex], providerCostUsd }, "33ms Release refinement");
      res.json(videoSuccess({ releaseIndex, releaseTimestamp: timestamps[releaseIndex], totalFrames: frames.length }));
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
      res.json(videoSuccess({ shotIndex: indices[0], shotTimestamp: timestamps[indices[0]], totalFrames: frames.length }));
      return;
    }
    if (availableEvidence) {
      // No phase labels are asserted for sparse/incomplete evidence.
      indices = [0];
    } else if (mode === "analyze" && phaseIndices) {
      if (!Array.isArray(phaseIndices) || phaseIndices.length !== 3 ||
          phaseIndices.some((index, i) => !Number.isInteger(index) || index < 0 ||
            index >= frames.length || (i > 0 && index <= phaseIndices[i - 1]))) {
        res.status(400).json({ ok: false, error: "Final phases must be three ordered, bounded frame indices." });
        return;
      }
      indices = phaseIndices;
    } else if (frames.length > 1) {
      const labeledFrameMessages = labeledImages(frames, timestamps, mimeType);
      const setReleaseIndices = await selectWithCorrection(frames.length, 2,
        async (correction, jsonMode) => {
          const [response] = await batchProcess([0], () => openrouter.chat.completions.create({
            model: ANALYSIS_MODEL,
            max_tokens: 8192,
            temperature: 0,
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            messages: [
              { role: "system", content: mode === "prepare" ? PREPARE_RELEASE_PROMPT : SET_RELEASE_SELECTION_PROMPT },
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
      const releaseIdx = mode === "prepare" ? proposedReleaseIdx : await verifyRelease(frames, timestamps, mimeType, setPointIdx, proposedReleaseIdx,
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
    if (mode === "prepare") {
      res.json(videoSuccess({ keyFrameIndices: indices, keyFrameTimestamps: indices.map(i => timestamps[i]), totalFrames: frames.length }));
      return;
    }
    const [dipIdx, setPointIdx = 0, releaseIdx = 0] = indices;
    const labeledFrameMessages = labeledImages(frames, timestamps, mimeType);
    const bestFrameIndex = setPointIdx;

    // Rhythm is separate from selection: it cannot replace the validated phases.
    const stepOneJobs = [
      ...(frames.length >= 3 && !availableEvidence ? ["rhythm" as const] : []),
    ];
    const stepOneResults = await batchProcess<"rhythm", {
      job: "rhythm"; response: { choices: { message: { content: string | null } }[] };
    }>(
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
    ).catch(() => {
      req.log.warn("Optional rhythm analysis unavailable; grading visible mechanics only");
      return [];
    });
    const rhythmResult = stepOneResults[0]?.response ?? null;

    // Parse rhythm
    let rhythm: { dipFrame?: number; setPointFrame?: number; armExtendFrame?: number; ballLeavesHandFrame?: number; followThroughFrame?: number; ballRiseFrame?: number; bodyRiseFrame?: number; pattern?: string; rhythmScore?: number; observations?: string[] } | null = null;
    if (rhythmResult) {
      const rhythmContent = rhythmResult.choices[0]?.message?.content ?? "{}";
      try {
        const jsonMatch = rhythmContent.match(/\{[\s\S]*\}/);
        rhythm = z.object({
          rhythmScore: z.number().min(0).max(100).optional(),
          pattern: z.enum(["synchronized", "set-then-drive", "disconnected", "unknown"]).optional(),
          observations: z.array(z.string()).optional(),
          adjustments: z.array(z.string()).catch([]),
          dipFrame: z.number().optional(),
          armExtendFrame: z.number().optional(),
          ballLeavesHandFrame: z.number().optional(),
          followThroughFrame: z.number().optional(),
          ballRiseFrame: z.number().optional(),
          bodyRiseFrame: z.number().optional(),
        }).passthrough().parse(JSON.parse(jsonMatch ? jsonMatch[0] : rhythmContent));
      } catch {
        req.log.warn("Failed to parse rhythm analysis");
      }
    }

    const rhythmReliable = reliableRhythm(rhythm, indices);
    // Phase selection, never rhythm percentages, owns all displayed/annotated indices.
    if (rhythm && frames.length > 1) {
      rhythm.dipFrame = dipIdx;
      rhythm.setPointFrame = setPointIdx;
      rhythm.followThroughFrame = releaseIdx;
    }
    req.log.info({ bestFrameIndex, dipIdx, setPointIdx, releaseIdx }, "Step 2: running biomechanics with 3 key frames");

    // Build biomechanics prompt with all 3 key frames for annotation accuracy
    const isVideoSession = frames.length > 1;
    const biomechanicsUserContent: Array<
      | { type: "image_url"; image_url: { url: string; detail: "high" | "low" } }
      | { type: "text"; text: string }
    > = [];
    biomechanicsUserContent.push({ type: "text", text: `The shooter is ${shootingHand!.toUpperCase()}-handed. The SHOOTING hand is behind/under the ball; the GUIDE hand is on the side. Grade ONLY the shooting arm's elbow. Identify shootingArmSide and elbowVisible before scoring.` });

    if (availableEvidence) {
      biomechanicsUserContent.push(
        { type: "text", text: "AVAILABLE EVIDENCE: these chronological images do not have validated shot-phase labels. Grade any visibly assessable shooting mechanics across them; leave unknown mechanics null. Do not invent a Dip, Set Point or Release. For annotations use frameIndex 0 ONLY and coordinates from the FIRST supplied image; omit zones hidden in that first image." },
        ...labeledFrameMessages,
      );
    } else if (isVideoSession) {
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
          temperature: 0.2,
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
    let parsedAnalysis;
    try {
      if (analysisResponse.choices[0]?.finish_reason !== "stop") throw new Error("Incomplete analysis");
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsedAnalysis = parsePartialAnalysis(JSON.parse(jsonMatch ? jsonMatch[0] : content), availableEvidence || frames.length === 1 ? 1 : 3);
    } catch (error) {
      if (error instanceof ScoringEvidenceError) throw error;
      req.log.error("Failed to parse biomechanics JSON");
      res.status(422).json({ ok: false, error: "The analysis was incomplete. Please try again." });
      return;
    }
    const { analysis } = parsedAnalysis;

    req.log.info(
      { rhythmReliable, dipFrame: rhythm?.dipFrame, armExtendFrame: rhythm?.armExtendFrame, rhythmScore: rhythm?.rhythmScore },
      "Rhythm reliability check"
    );

    let score;
    try {
      score = calculateShotScore(analysis?.components, rhythmReliable ? rhythm!.rhythmScore : null);
    } catch (error) {
      req.log.warn("Rejected biomechanics JSON: invalid evidence; no zero substituted");
      throw error;
    }
    req.log.info({ ...score, rhythmIncluded: rhythmReliable }, "Evidence-based score calculation");
    const validated = AnalyzeFormResponse.safeParse({ analysis: { ...analysis, overallScore: score.overallScore }, timestamp: new Date().toISOString() });
    if (!validated.success) {
      req.log.warn({ errors: validated.error.issues }, "Video analysis failed schema validation");
      res.status(422).json({ ok: false, error: "The analysis was incomplete. Please try again." });
      return;
    }

    req.log.info({ model: ANALYSIS_MODEL, providerCostUsd }, "Analysis provider cost");
    res.json(videoSuccess({
      analysis: validated.data.analysis,
      ...assessCaptureQuality(analysis.components, parsedAnalysis.issues, availableEvidence),
      rhythm: rhythmReliable ? rhythm : null,
      bestFrameIndex,
      totalFrames: frames.length,
      timestamp: new Date().toISOString(),
      keyFrameIndices: indices,
      keyFrameTimestamps: indices.map(i => timestamps[i]),
      keyFrameLabels: availableEvidence ? ["Available frame"] : isVideoSession ? ["Dip", "Set Point", "Release"] : ["Photo"],
    }));
  } catch (err) {
    req.log.warn({ model: ANALYSIS_MODEL, providerCostUsd }, "Partial analysis provider cost");
    if (err instanceof ScoringEvidenceError) {
      res.status(422).json({ ok: false, error: err.message, code: "SCORING_EVIDENCE_INSUFFICIENT", retryable: false });
      return;
    }
    if (err instanceof FrameSelectionError) {
      res.status(422).json({ ok: false, error: err.message, code: "FRAME_SELECTION_UNCERTAIN", retryable: true });
      return;
    }
    const status = (err as { status?: number })?.status;
    req.log.error({ status }, "Video analysis provider request failed");
    const failure = providerFailure(err);
    res.status(failure.status).json({ ...failure.body, ok: false });
  }
});

export default router;
