import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { BIOMECHANICS_SYSTEM_PROMPT, RHYTHM_SYSTEM_PROMPT } from "../lib/prompts";

const router = Router();

const BEST_FRAME_PROMPT = `You are a basketball shooting form expert. You will receive multiple frames from a basketball shooting video.

Your task: identify which single frame number best captures the shooting mechanics for biomechanical analysis. 

The ideal frame shows:
- The shooter at or near their release point (arm fully extended, wrist snapped)
- OR the set point (ball at right-eyebrow height, face/vision clear)
- Clear full-body visibility
- Minimal motion blur

Respond with ONLY a JSON object: { "bestFrameIndex": <0-based index>, "reason": "<10-word explanation>" }`;

/** Mirror of the mobile key-frame selection heuristic so annotation
 *  coordinates always refer to the exact frames displayed in the strip. */
function selectKeyFrameIndices(
  totalFrames: number,
  rhythm: { dipFrame?: number; setPointFrame?: number; armExtendFrame?: number } | null
): { dipIdx: number; setPointIdx: number; releaseIdx: number } {
  let dipIdx = (() => {
    const d = rhythm?.dipFrame;
    if (d !== undefined && d >= 0 && d < totalFrames * 0.45) return d;
    return Math.floor(totalFrames * 0.20);
  })();

  let setPointIdx = (() => {
    const sp = rhythm?.setPointFrame;
    if (sp !== undefined && sp > dipIdx && sp >= totalFrames * 0.4 && sp < totalFrames * 0.75) return sp;
    const ae = rhythm?.armExtendFrame;
    if (ae !== undefined && ae > dipIdx + 1) return ae - 1;
    return Math.floor(totalFrames * 0.55);
  })();

  let releaseIdx = (() => {
    const ae = rhythm?.armExtendFrame;
    if (ae !== undefined && ae > setPointIdx && ae >= totalFrames * 0.6 && ae < totalFrames * 0.95) return ae;
    return Math.floor(totalFrames * 0.78);
  })();

  dipIdx      = Math.max(0, Math.min(dipIdx,      totalFrames - 1));
  setPointIdx = Math.max(0, Math.min(setPointIdx, totalFrames - 1));
  releaseIdx  = Math.max(0, Math.min(releaseIdx,  totalFrames - 1));

  if (setPointIdx <= dipIdx)      setPointIdx = Math.min(dipIdx      + 1, totalFrames - 1);
  if (releaseIdx  <= setPointIdx) releaseIdx  = Math.min(setPointIdx + 1, totalFrames - 1);

  return { dipIdx, setPointIdx, releaseIdx };
}

router.post("/analyze-video", async (req, res) => {
  try {
    const { frames, timestamps, mimeType = "image/jpeg" } = req.body as {
      frames: string[];
      timestamps?: number[];
      mimeType?: string;
    };

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ error: "frames array is required" });
      return;
    }

    if (frames.length > 12) {
      res.status(400).json({ error: "Maximum 12 frames allowed" });
      return;
    }

    req.log.info({ frameCount: frames.length }, "Step 1: best frame + rhythm in parallel");

    // Build labeled frame messages for the rhythm prompt
    const labeledFrameMessages = frames.flatMap((b64, i) => {
      const ms = timestamps?.[i] ?? i * 200;
      return [
        {
          type: "image_url" as const,
          image_url: { url: `data:${mimeType};base64,${b64}`, detail: "low" as const },
        },
        { type: "text" as const, text: `Frame ${i} @ ${ms}ms` },
      ];
    });

    // Step 1: best frame selection + rhythm in parallel — both need all frames at low detail
    const [selectionResult, rhythmResult] = await Promise.all([
      frames.length > 1
        ? openai.chat.completions.create({
            model: "gpt-5-mini",
            max_completion_tokens: 128,
            messages: [
              { role: "system", content: BEST_FRAME_PROMPT },
              {
                role: "user",
                content: [
                  ...frames.map((b64) => ({
                    type: "image_url" as const,
                    image_url: { url: `data:${mimeType};base64,${b64}`, detail: "low" as const },
                  })),
                  {
                    type: "text" as const,
                    text: `These are ${frames.length} frames from a basketball shooting video. Which frame index (0-based) best shows the shooting mechanics at the key moment (release or set point)? Respond with JSON only.`,
                  },
                ],
              },
            ],
          })
        : Promise.resolve(null),
      frames.length >= 3
        ? openai.chat.completions.create({
            model: "gpt-5.4",
            max_completion_tokens: 512,
            messages: [
              { role: "system", content: RHYTHM_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  ...labeledFrameMessages,
                  {
                    type: "text" as const,
                    text: `These are ${frames.length} sequential frames from a basketball shooting video${timestamps ? ` spanning ${timestamps[timestamps.length - 1]}ms` : ""}. Analyze the temporal motion sequence to determine the shot rhythm pattern. Look specifically for: when does the body/legs drive up vs when does the ball rise (body-first = good kinetic chain). Return ONLY valid JSON.`,
                  },
                ],
              },
            ],
          })
        : Promise.resolve(null),
    ]);

    // Parse best frame
    let bestFrameIndex = Math.floor(frames.length / 2);
    if (selectionResult) {
      const selectionContent = selectionResult.choices[0]?.message?.content ?? "{}";
      try {
        const jsonMatch = selectionContent.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : selectionContent) as { bestFrameIndex: number };
        if (typeof parsed.bestFrameIndex === "number" && parsed.bestFrameIndex >= 0 && parsed.bestFrameIndex < frames.length) {
          bestFrameIndex = parsed.bestFrameIndex;
        }
      } catch {
        req.log.warn("Failed to parse frame selection, using middle frame");
      }
    }

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

    // Step 2: compute the 3 key frame indices using the same heuristic as the mobile client.
    // This guarantees annotation coordinates match the exact frames shown in the strip.
    const { dipIdx, setPointIdx, releaseIdx } = selectKeyFrameIndices(frames.length, rhythm);
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
          text: "PRIMARY ANALYSIS FRAME (use for all 8 component scores and feedback): Analyze this basketball shooting form image extracted from a video at the optimal moment. Evaluate all 8 biomechanical components using the coaching framework provided. Pay close attention to: whether elbows are IN or flaring, guide hand placement (side only, not underneath), grip gap between ball and palm (no huge gap — controlled finger-pad grip), loaded wrist, 65° hand angle, right-eyebrow set point, ball not covering the face, pushing ball UP at release, wrist snap quality, arm staying high, eyes tracking ball post-release, and relaxed shoulders.",
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[dipIdx]}`, detail: "low" },
        },
        {
          type: "text",
          text: `KEY FRAME — frameIndex: 0 (Dip phase, frame ${dipIdx}/${frames.length - 1}). Place annotations with frameIndex 0 at the exact body-part positions visible in THIS image. Use for: stance (feet), hipAlignment (hips), balance (whole body center of mass).`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[setPointIdx]}`, detail: "low" },
        },
        {
          type: "text",
          text: `KEY FRAME — frameIndex: 1 (Set Point phase, frame ${setPointIdx}/${frames.length - 1}). Place annotations with frameIndex 1 at the exact body-part positions visible in THIS image. Use for: elbowPosition (shooting elbow), gripPosition (shooting hand/wrist), setPoint (ball position at ear/eyebrow).`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[releaseIdx]}`, detail: "low" },
        },
        {
          type: "text",
          text: `KEY FRAME — frameIndex: 2 (Release phase, frame ${releaseIdx}/${frames.length - 1}). Place annotations with frameIndex 2 at the exact body-part positions visible in THIS image. Use for: followThrough (shooting wrist/arm finish), eyeTracking (eyes/head direction).`,
        },
        {
          type: "text",
          text: "Return ONLY valid JSON as specified. CRITICAL for annotations: use the exact pixel coordinates from each labeled KEY FRAME image — do NOT guess positions. frameIndex 0 = Dip image, frameIndex 1 = Set Point image, frameIndex 2 = Release image.",
        }
      );
    } else {
      biomechanicsUserContent.push(
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${frames[0]}`, detail: "high" },
        },
        {
          type: "text",
          text: "Analyze this basketball shooting form image. Evaluate all 8 biomechanical components using the coaching framework provided. Pay close attention to: whether elbows are IN or flaring, guide hand placement (side only, not underneath), grip gap between ball and palm (no huge gap — controlled finger-pad grip), loaded wrist, 65° hand angle, right-eyebrow set point, ball not covering the face, pushing ball UP at release, wrist snap quality, arm staying high, eyes tracking ball post-release, and relaxed shoulders.",
        },
        {
          type: "text",
          text: "Return ONLY valid JSON as specified. Use frameIndex 0 for all annotations.",
        }
      );
    }

    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: BIOMECHANICS_SYSTEM_PROMPT },
        { role: "user", content: biomechanicsUserContent },
      ],
    });

    // Parse biomechanics
    const content = analysisResponse.choices[0]?.message?.content ?? "{}";
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      req.log.error({ content }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "Failed to parse analysis response" });
      return;
    }

    res.json({
      analysis,
      rhythm,
      bestFrameIndex,
      totalFrames: frames.length,
      timestamp: new Date().toISOString(),
      keyFrameIndices: isVideoSession ? [dipIdx, setPointIdx, releaseIdx] : [0],
    });
  } catch (err) {
    req.log.error({ err }, "Error analyzing video frames");
    res.status(500).json({ error: "Video analysis failed. Please try again." });
  }
});

export default router;
