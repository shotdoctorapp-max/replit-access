import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { BIOMECHANICS_SYSTEM_PROMPT } from "../lib/prompts";

const router = Router();

router.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const response = await openai.chat.completions.create({
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
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Analyze this basketball shooting form image. Evaluate all 8 biomechanical components using the coaching framework provided. Pay close attention to: loaded wrist, 65° hand angle, right-eyebrow set point, ball not covering the face, elbows in and relaxed, pushing ball UP at release, wrist snap quality, arm staying high, eyes tracking ball post-release, and relaxed shoulders. Return ONLY valid JSON as specified.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      req.log.error({ content }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "Failed to parse analysis response" });
      return;
    }

    res.json({ analysis, timestamp: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error analyzing shooting form");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
