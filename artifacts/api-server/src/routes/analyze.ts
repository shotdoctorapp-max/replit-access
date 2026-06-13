import { Router } from "express";
import { requireAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { BIOMECHANICS_SYSTEM_PROMPT } from "../lib/prompts";
import { AnalyzeFormResponse } from "@workspace/api-zod";
import { analysisRateLimit } from "../middlewares/analysisRateLimit";

const router = Router();

router.post("/analyze", requireAuth(), analysisRateLimit, async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: BIOMECHANICS_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Analyze this basketball shooting form image. Evaluate all 8 biomechanical components using the coaching framework provided. Pay close attention to: whether elbows are IN or flaring, guide hand placement (side only, not underneath), grip gap between ball and palm (no huge gap), loaded wrist, 65° hand angle, right-eyebrow set point, ball not covering the face, pushing ball UP at release, wrist snap quality, arm staying high, eyes tracking ball post-release, and relaxed shoulders. Return ONLY valid JSON as specified.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    let rawAnalysis: unknown;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      rawAnalysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      req.log.error({ content }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "Failed to parse analysis response" });
      return;
    }

    const parsed = AnalyzeFormResponse.safeParse({
      analysis: rawAnalysis,
      timestamp: new Date().toISOString(),
    });

    if (!parsed.success) {
      req.log.warn({ errors: parsed.error.issues, rawAnalysis }, "AI response failed schema validation — passing through raw");
      res.json({ analysis: rawAnalysis, timestamp: new Date().toISOString() });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Error analyzing shooting form");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
