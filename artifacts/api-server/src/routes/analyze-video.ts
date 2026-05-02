import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const BEST_FRAME_PROMPT = `You are a basketball shooting form expert. You will receive multiple frames from a basketball shooting video.

Your task: identify which single frame number best captures the shooting mechanics for biomechanical analysis. 

The ideal frame shows:
- The shooter at or near their release point (arm fully extended, wrist snapped)
- OR the set point (ball at release position above forehead)
- Clear full-body visibility
- Minimal motion blur

Respond with ONLY a JSON object: { "bestFrameIndex": <0-based index>, "reason": "<10-word explanation>" }`;

const BIOMECHANICS_SYSTEM_PROMPT = `You are an elite basketball shooting form analyst and biomechanics expert. Your role is to analyze basketball shooting mechanics from images with the precision of a professional coach.

When analyzing a shooting form image, evaluate these biomechanical components:

1. **Stance & Base**: Feet positioning, shoulder-width stance, dominant foot alignment
2. **Hip & Core Alignment**: Hip position, core engagement, weight distribution
3. **Elbow Position**: Shooting elbow alignment under the ball (90° ideal), guide hand position
4. **Grip & Hand Position**: Ball placement in fingers vs palm, guide hand placement
5. **Set Point**: Ball release position relative to head, consistency of starting position
6. **Arm Extension**: Full arm extension at release, wrist snap, follow-through
7. **Body Balance**: Overall balance throughout the motion, jump alignment (if jump shot)
8. **Head & Eye Tracking**: Head stillness, eye contact with target

Respond ONLY with valid JSON in exactly this format:
{
  "overallScore": <0-100 integer>,
  "summary": "<2-3 sentence expert summary of the shooter's form>",
  "components": {
    "stance": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" },
    "hipAlignment": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" },
    "elbowPosition": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" },
    "gripPosition": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" },
    "setPoint": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" },
    "followThrough": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" },
    "balance": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" },
    "eyeTracking": { "score": <0-100>, "feedback": "<specific observation and improvement tip>" }
  },
  "keyStrengths": ["<strength 1>", "<strength 2>"],
  "priorityFixes": ["<fix 1>", "<fix 2>", "<fix 3>"],
  "drillRecommendations": [
    { "name": "<drill name>", "description": "<30-word description>", "targetArea": "<component it improves>" },
    { "name": "<drill name>", "description": "<30-word description>", "targetArea": "<component it improves>" },
    { "name": "<drill name>", "description": "<30-word description>", "targetArea": "<component it improves>" }
  ]
}`;

const RHYTHM_SYSTEM_PROMPT = `You are a basketball shooting mechanics expert specializing in temporal motion analysis and kinetic chain sequencing.

You will receive sequential frames from a basketball shooting video, each labeled with its timestamp in milliseconds.

Analyze the MOTION SEQUENCE across all frames. Identify:
1. ballRiseFrame: The frame index where the ball clearly begins its upward rise toward the release point
2. bodyRiseFrame: The frame index where the legs/hips begin their upward drive (the "dip" ends and the body starts extending)
3. armExtendFrame: The frame index where the shooting arm begins extending toward full extension/release

Then classify the sequencing pattern:
- "ball-first": Ball rises BEFORE the legs/hips drive — arm-dependent, disconnected from the body's power
- "body-first": Legs/hips rise BEFORE the ball — correct kinetic chain, power flows from ground up
- "synchronized": Body and ball rise together in one fluid motion — ideal for set shots and catch-and-shoot
- "unknown": Cannot determine clearly from the provided frames

Provide 2-3 specific observations about the timing and how to improve it.

Respond ONLY with valid JSON:
{
  "pattern": "ball-first" | "body-first" | "synchronized" | "unknown",
  "ballRiseFrame": <0-based index or -1 if unclear>,
  "bodyRiseFrame": <0-based index or -1 if unclear>,
  "armExtendFrame": <0-based index or -1 if unclear>,
  "rhythmScore": <0-100 integer, 100 = perfect kinetic chain>,
  "observations": ["<timing observation 1>", "<timing observation 2>", "<timing observation 3>"]
}`;

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

    // Build labeled frame messages for multi-frame prompts
    const labeledFrameMessages = frames.map((b64, i) => {
      const ms = timestamps?.[i] ?? i * 200;
      return [
        {
          type: "image_url" as const,
          image_url: { url: `data:${mimeType};base64,${b64}`, detail: "low" as const },
        },
        {
          type: "text" as const,
          text: `Frame ${i} @ ${ms}ms`,
        },
      ];
    }).flat();

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
              ...frames.map((b64, i) => ({
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

    // Step 2: biomechanics + rhythm in parallel
    const [analysisResponse, rhythmResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: BIOMECHANICS_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${frames[bestFrameIndex]}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: "Analyze this basketball shooting form image extracted from a video at the optimal moment. Evaluate all biomechanical components and provide detailed expert feedback. Return ONLY valid JSON as specified.",
              },
            ],
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
                    text: `These are ${frames.length} sequential frames from a basketball shooting video${timestamps ? ` spanning ${timestamps[timestamps.length - 1]}ms` : ""}. Analyze the temporal motion sequence to determine the shot rhythm pattern. Return ONLY valid JSON.`,
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
    });
  } catch (err) {
    req.log.error({ err }, "Error analyzing video frames");
    res.status(500).json({ error: "Video analysis failed. Please try again." });
  }
});

export default router;
