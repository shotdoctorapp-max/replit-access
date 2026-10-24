import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openrouter } from "../../lib/integrations-openrouter-ai/src/index";
import { BIOMECHANICS_SYSTEM_PROMPT } from "../../artifacts/api-server/src/lib/prompts";
import { calculateShotScore, COMPONENT_KEYS, ScoringEvidenceError } from "../../artifacts/api-server/src/lib/scoring";

const model = process.env.ANALYSIS_MODEL ?? "google/gemini-2.5-flash";
const clips = [
  { file: "WhatsApp_Video_2026-05-01_at_11.29.09_PM_1777649371569.mp4", seeks: [0.3, 0.7, 0.9] },
  { file: "WhatsApp_Video_2026-05-01_at_9.04.30_PM_1777640689387.mp4", seeks: [6.8, 8.4, 9.1] },
];
for (const clip of clips) {
  const source = fileURLToPath(new URL(`../../attached_assets/${clip.file}`, import.meta.url));
  const images = clip.seeks.map(time => execFileSync("ffmpeg", [
    "-v", "error", "-ss", String(time), "-i", source, "-frames:v", "1",
    "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "4", "pipe:1",
  ], { maxBuffer: 1_000_000 }).toString("base64"));
  const samples: Array<{ scores: Record<string, number | null>; total: number | null }> = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await openrouter.chat.completions.create({
      model, temperature: 0, max_tokens: 8192, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BIOMECHANICS_SYSTEM_PROMPT },
        { role: "user", content: [
          ...images.flatMap((image, i) => [
            { type: "text" as const, text: `KEY FRAME frameIndex=${i}: ${["Dip", "Set Point", "Release"][i]}. Requested source seek ${clip.seeks[i]}s (not decoded PTS).` },
            { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${image}`, detail: "high" as const } },
          ]),
          { type: "text", text: "Use Dip for stance/hips/balance, Set Point for elbow/grip/set point, Release for follow-through/eye tracking. Compare phases only for visible motion. Do not infer hidden feet, fingertip pressure, gaze, spin, shot outcome or consistency across shots. Use score:null for unassessable components. Return only JSON." },
        ] },
      ],
    }, { maxRetries: 0, timeout: 90_000 });
    if (response.choices[0]?.finish_reason !== "stop") throw new Error("Incomplete calibration response");
    const result = JSON.parse(response.choices[0]?.message.content ?? "{}");
    let total: number | null = null;
    try { total = calculateShotScore(result.components).overallScore; }
    catch (error) { if (!(error instanceof ScoringEvidenceError)) throw error; }
    const scores = Object.fromEntries(COMPONENT_KEYS.map(key => [key, result.components?.[key]?.score ?? null]));
    samples.push({ scores, total });
    console.log(JSON.stringify({ clip: clip.file, attempt, scores, total,
      feedback: Object.fromEntries(COMPONENT_KEYS.map(key => [key, result.components?.[key]?.feedback ?? null])) }));
  }
  const ranges = Object.fromEntries(COMPONENT_KEYS.map(key => {
    const values = samples.map(s => s.scores[key]).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    return [key, { measuredRuns: values.length, range: values.length ? Math.max(...values) - Math.min(...values) : null }];
  }));
  const totals = samples.map(s => s.total).filter((n): n is number => n !== null);
  console.log(JSON.stringify({ clip: clip.file, model, ranges, scoredRuns: totals.length,
    totalRange: totals.length ? Math.max(...totals) - Math.min(...totals) : null }));
}
