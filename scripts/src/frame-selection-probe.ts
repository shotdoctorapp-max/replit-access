import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { openrouter, batchProcess } from "../../lib/integrations-openrouter-ai/src/index";
import { FRAME_SELECTION_PROMPT, LOCATE_SHOT_PROMPT, labeledImages, safeSelectionDiagnostic } from "../../artifacts/api-server/src/lib/frameSelection";
import { planFrameTimes } from "../../artifacts/mobile/utils/frameSampling";

const out = "/tmp/frame-selection-124";
mkdirSync(out, { recursive: true });
const route = execFileSync("git", ["show", "49bb3ae:artifacts/api-server/src/routes/analyze-video.ts"], { encoding: "utf8" });
const prompt = route.match(/const BEST_FRAME_PROMPT = `([\s\S]*?)`;/)?.[1];
const oldPrompts = execFileSync("git", ["show", "49bb3ae:artifacts/api-server/src/lib/prompts.ts"], { encoding: "utf8" });
const RHYTHM_SYSTEM_PROMPT = oldPrompts.match(/export const RHYTHM_SYSTEM_PROMPT = `([\s\S]*?)`;/)![1];
const after = process.argv.includes("--after");
const clips = [
  "attached_assets/WhatsApp_Video_2026-05-01_at_9.04.30_PM_1777640689387.mp4",
  "attached_assets/WhatsApp_Video_2026-05-01_at_11.29.09_PM_1777649371569.mp4",
];
for (const [clipIndex, clip] of clips.entries()) {
  const meta = JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-show_format", "-of", "json", clip], { encoding: "utf8" }));
  const duration = Number(meta.format.duration) * 1000;
  const plan = planFrameTimes(duration);
  const timestamps = after ? plan.timestamps :
    Array.from({ length: 12 }, (_, i) => Math.round(i * Math.max(150, duration / 11)));
  const frames = timestamps.map((t, i) => {
    const path = `${out}/${clipIndex}-${i}.jpg`;
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.min(t, duration - 200) / 1000), "-i", clip, "-frames:v", "1", "-q:v", "3", path]);
    return readFileSync(path).toString("base64");
  });
  const results = await batchProcess(after ? ["json-format-probe"] : ["selection", "rhythm"], async job => {
    try {
      const response = await openrouter.chat.completions.create({
        model: "google/gemma-4-31b-it:free",
        max_tokens: after ? 8192 : job === "selection" ? 128 : 512, // old limits ONLY for reproduction
        ...(after ? { temperature: 0, response_format: { type: "json_object" as const } } : {}),
        messages: [
          { role: "system", content: after ? (plan.coarse ? LOCATE_SHOT_PROMPT : FRAME_SELECTION_PROMPT) : job === "selection" ? prompt! : RHYTHM_SYSTEM_PROMPT },
          { role: "user", content: after ? labeledImages(frames, timestamps, "image/jpeg") : [
            ...frames.flatMap((b64, i) => [
              { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "low" as const } },
              ...(job === "rhythm" ? [{ type: "text" as const, text: `Frame ${i} @ ${timestamps[i]}ms` }] : []),
            ]),
            { type: "text", text: job === "selection"
              ? `These are ${frames.length} frames from a basketball shooting video. Which frame index (0-based) best shows the shooting mechanics at the key moment (release or set point)? Respond with JSON only.`
              : `These are ${frames.length} sequential frames from a basketball shooting video spanning ${timestamps.at(-1)}ms. Analyze the temporal motion sequence to determine the shot rhythm pattern. Look specifically for: when does the body/legs drive up vs when does the ball rise (body-first = good kinetic chain). Return ONLY valid JSON.` },
          ] },
        ],
      }, { maxRetries: 0, timeout: 90_000 });
      return { job, raw: safeSelectionDiagnostic(response.choices[0]?.message.content ?? ""), finish: response.choices[0]?.finish_reason, usage: response.usage };
    } catch (e: any) {
      return { job, error: { status: e.status, message: String(e.message).replace(/https?:\/\/\S+/g, "[url]").slice(0, 600) } };
    }
  }, { concurrency: 1, retries: 2, minTimeout: 2000, maxTimeout: 15000 });
  const evidence = { clipIndex, duration, fps: meta.streams.find((s: any) => s.codec_type === "video").avg_frame_rate, timestamps, results };
  writeFileSync(`${out}/${after ? "after" : "before"}-${clipIndex}.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}