import { Router } from "express";
import { requireAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { BIOMECHANICS_SYSTEM_PROMPT } from "../lib/prompts";
import { AnalyzeFormResponse } from "@workspace/api-zod";
import { analysisRateLimit } from "../middlewares/analysisRateLimit";
import { calculateShotScore, enforceElbowEvidence, ScoringEvidenceError } from "../lib/scoring";

const router = Router();

router.post("/analyze", requireAuth(), analysisRateLimit, async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", shootingHand } = req.body;
    if (!["right", "left"].includes(shootingHand)) {
      res.status(400).json({ error: "Choose your shooting hand before analyzing." });
      return;
    }

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
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
              text: `The shooter is ${shootingHand.toUpperCase()}-handed. Identify the shooting hand behind/under the ball, not the guide hand at the side. Grade ONLY the shooting elbow and output shootingArmSide and elbowVisible first. Assess only visible evidence. Return score:null for unassessable components, never a default.`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    let rawAnalysis;
    try {
      if (response.choices[0]?.finish_reason !== "stop") throw new Error("Incomplete analysis");
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      rawAnalysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      req.log.error("Failed to parse complete AI response as JSON");
      res.status(500).json({ error: "Failed to parse analysis response" });
      return;
    }

    enforceElbowEvidence(rawAnalysis);
    const score = calculateShotScore(rawAnalysis?.components);
    rawAnalysis.overallScore = score.overallScore;
    req.log.info(score, "Evidence-based photo score calculation");
    const parsed = AnalyzeFormResponse.safeParse({
      analysis: rawAnalysis,
      timestamp: new Date().toISOString(),
    });

    if (!parsed.success) {
      req.log.warn({ errors: parsed.error.issues }, "AI response failed schema validation");
      res.status(422).json({ error: "The analysis was incomplete. Please use a clearer view and try again." });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    if (err instanceof ScoringEvidenceError) {
      res.status(422).json({ error: err.message, code: "SCORING_EVIDENCE_INSUFFICIENT", retryable: false });
      return;
    }
    req.log.error({ err }, "Error analyzing shooting form");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
