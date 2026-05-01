import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

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
        {
          role: "system",
          content: BIOMECHANICS_SYSTEM_PROMPT,
        },
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
              text: "Analyze this basketball shooting form image. Evaluate all biomechanical components and provide detailed expert feedback. Return ONLY valid JSON as specified.",
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
