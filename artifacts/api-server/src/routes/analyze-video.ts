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

    req.log.info({ frameCount: frames.length }, "Selecting best frame from video");

    // Build labeled frame messages for the rhythm multi-frame prompt
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

    // Step 1: select best frame
    let bestFrameIndex = 0;
    if (frames.length > 1) {
      const selectionResponse = await openai.chat.completions.create({
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
      });

      const selectionContent = selectionResponse.choices[0]?.message?.content ?? "{}";
      try {
        const jsonMatch = selectionContent.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : selectionContent) as {
          bestFrameIndex: number;
        };
        if (
          typeof parsed.bestFrameIndex === "number" &&
          parsed.bestFrameIndex >= 0 &&
          parsed.bestFrameIndex < frames.length
        ) {
          bestFrameIndex = parsed.bestFrameIndex;
        }
      } catch {
        req.log.warn("Failed to parse frame selection, using middle frame");
        bestFrameIndex = Math.floor(frames.length / 2);
      }
    }

    req.log.info({ bestFrameIndex }, "Running biomechanics + rhythm analysis in parallel");

    // Estimate the two key frame positions used for annotations:
    // frameIndex 0 = Dip (~25% through the sequence)
    // frameIndex 1 = Set Point (~62% through the sequence)
    const dipFrameIdx = Math.max(0, Math.floor(frames.length * 0.25));
    const setPointFrameIdx = Math.min(frames.length - 1, Math.floor(frames.length * 0.62));

    // Build user content: best frame for primary biomechanics analysis,
    // then the two annotation key frames labeled by their frameIndex.
    const biomechanicsUserContent: Array<
      | { type: "image_url"; image_url: { url: string; detail: "high" | "low" } }
      | { type: "text"; text: string }
    > = [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${frames[bestFrameIndex]}`,
          detail: "high",
        },
      },
      {
        type: "text",
        text: "PRIMARY ANALYSIS FRAME (use for all 8 component scores and feedback): Analyze this basketball shooting form image extracted from a video at the optimal moment. Evaluate all 8 biomechanical components using the coaching framework provided. Pay close attention to: whether elbows are IN or flaring, guide hand placement (side only, not underneath), grip gap between ball and palm (no huge gap — controlled finger-pad grip), loaded wrist, 65° hand angle, right-eyebrow set point, ball not covering the face, pushing ball UP at release, wrist snap quality, arm staying high, eyes tracking ball post-release, and relaxed shoulders.",
      },
    ];

    // Only include separate key frames if they differ from bestFrameIndex and from each other
    if (dipFrameIdx !== bestFrameIndex) {
      biomechanicsUserContent.push(
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${frames[dipFrameIdx]}`,
            detail: "low",
          },
        },
        {
          type: "text",
          text: `ANNOTATION FRAME — frameIndex: 0 (Dip phase, ~${Math.round(dipFrameIdx / frames.length * 100)}% through shot). Use this frame's body part positions for all annotations with frameIndex: 0.`,
        }
      );
    }
    if (setPointFrameIdx !== bestFrameIndex && setPointFrameIdx !== dipFrameIdx) {
      biomechanicsUserContent.push(
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${frames[setPointFrameIdx]}`,
            detail: "low",
          },
        },
        {
          type: "text",
          text: `ANNOTATION FRAME — frameIndex: 1 (Set Point phase, ~${Math.round(setPointFrameIdx / frames.length * 100)}% through shot). Use this frame's body part positions for all annotations with frameIndex: 1. Place upper-body zone annotations (elbowPosition, gripPosition, setPoint, followThrough, eyeTracking) on this frame. Place lower-body zone annotations (stance, hipAlignment, balance) on frameIndex: 0.`,
        }
      );
    }

    biomechanicsUserContent.push({
      type: "text",
      text: "Return ONLY valid JSON as specified. For annotations, use the Dip frame (frameIndex 0) for lower-body zones and the Set Point frame (frameIndex 1) for upper-body zones. If only one distinct frame is available, use frameIndex 0 for all annotations.",
    });

    // Step 2: biomechanics + rhythm in parallel
    const [analysisResponse, rhythmResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: BIOMECHANICS_SYSTEM_PROMPT },
          {
            role: "user",
            content: biomechanicsUserContent,
          },
        ],
      }),
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
                    type: "text",
                    text: `These are ${frames.length} sequential frames from a basketball shooting video${timestamps ? ` spanning ${timestamps[timestamps.length - 1]}ms` : ""}. Analyze the temporal motion sequence to determine the shot rhythm pattern. Look specifically for: when does the body/legs drive up vs when does the ball rise (body-first = good kinetic chain). Return ONLY valid JSON.`,
                  },
                ],
              },
            ],
          })
        : Promise.resolve(null),
    ]);

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

    // Parse rhythm
    let rhythm = null;
    if (rhythmResponse) {
      const rhythmContent = rhythmResponse.choices[0]?.message?.content ?? "{}";
      try {
        const jsonMatch = rhythmContent.match(/\{[\s\S]*\}/);
        rhythm = JSON.parse(jsonMatch ? jsonMatch[0] : rhythmContent);
      } catch {
        req.log.warn("Failed to parse rhythm analysis");
      }
    }

    res.json({
      analysis,
      rhythm,
      bestFrameIndex,
      totalFrames: frames.length,
      timestamp: new Date().toISOString(),
      annotationDipFrame: dipFrameIdx,
      annotationSetPointFrame: setPointFrameIdx,
    });
  } catch (err) {
    req.log.error({ err }, "Error analyzing video frames");
    res.status(500).json({ error: "Video analysis failed. Please try again." });
  }
});

export default router;
