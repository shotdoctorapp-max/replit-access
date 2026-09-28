import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openrouter } from "../../lib/integrations-openrouter-ai/src/index";
import {
  FrameSelectionError,
  SET_RELEASE_SELECTION_PROMPT,
  VERIFY_RELEASE_PROMPT,
  labeledImages,
  selectWithCorrection,
  validateSetReleaseIndices,
  verifyRelease,
} from "../../artifacts/api-server/src/lib/frameSelection";
import { planFrameTimes } from "../../artifacts/mobile/utils/frameSampling";

// These are requested ffmpeg seek positions, not decoded-frame PTS or Expo thumbnails.
const negativeOnly = process.argv.includes("--negative-only");
const clips = [
  { path: "attached_assets/WhatsApp_Video_2026-05-01_at_11.29.09_PM_1777649371569.mp4" },
  { path: "attached_assets/WhatsApp_Video_2026-05-01_at_9.04.30_PM_1777640689387.mp4", anchorMs: 8000 },
].slice(0, negativeOnly ? 1 : 2);
const model = process.env.ANALYSIS_MODEL ?? "google/gemini-2.5-flash";

for (const clip of clips) {
  const source = fileURLToPath(new URL(`../../${clip.path}`, import.meta.url));
  const durationMs = Math.round(Number(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nokey=1:noprint_wrappers=1", source,
  ], { encoding: "utf8" })) * 1000);
  const { timestamps } = planFrameTimes(durationMs, clip.anchorMs);
  const frames = timestamps.map(time =>
    execFileSync("ffmpeg", [
      "-v", "error", "-ss", String(time / 1000), "-i", source, "-frames:v", "1",
      "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "4", "pipe:1",
    ], { maxBuffer: 1_000_000 }).toString("base64"));
  const request = async (prompt: string, images: ReturnType<typeof labeledImages>,
    correction: string | undefined, jsonMode: boolean) => {
    const response = await openrouter.chat.completions.create({
      model, temperature: 0, max_tokens: 8192,
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: images },
        ...(correction ? [{ role: "user" as const, content: correction }] : []),
      ],
    }, { maxRetries: 0, timeout: 90_000 });
    return { raw: response.choices[0]?.message.content ?? "", finish: response.choices[0]?.finish_reason };
  };

  if (negativeOnly) {
    try {
      const release = await verifyRelease(frames.slice(0, 8), timestamps.slice(0, 8),
        "image/jpeg", 5, 7,
        (images, correction, jsonMode) => request(VERIFY_RELEASE_PROMPT, images, correction, jsonMode),
        event => console.log(JSON.stringify({ clip: clip.path, phase: "contact-only", ...event })));
      throw new Error(`Contact-only clip incorrectly selected Release at sample ${release}`);
    } catch (error) {
      if (!(error instanceof FrameSelectionError)) throw error;
      console.log(JSON.stringify({ clip: clip.path, result: "Contact-only samples correctly rejected" }));
    }
    continue;
  }

  try {
    const [setPoint, proposedRelease] = await selectWithCorrection(frames.length, 2,
      (correction, jsonMode) => request(SET_RELEASE_SELECTION_PROMPT,
        labeledImages(frames, timestamps, "image/jpeg"), correction, jsonMode),
      event => console.log(JSON.stringify({ clip: clip.path, phase: "initial", ...event })),
      "setPoint,release", validateSetReleaseIndices);
    const release = await verifyRelease(frames, timestamps, "image/jpeg", setPoint, proposedRelease,
      (images, correction, jsonMode) => request(VERIFY_RELEASE_PROMPT, images, correction, jsonMode),
      event => console.log(JSON.stringify({ clip: clip.path, phase: "verified", ...event })));
    console.log(JSON.stringify({
      clip: clip.path, model, sampleCount: frames.length,
      selectedSampleIndices: { setPoint, proposedRelease, release },
      requestedSeekMs: { setPoint: timestamps[setPoint], proposedRelease: timestamps[proposedRelease], release: timestamps[release] },
      note: "Requested seek positions, not exact source-frame PTS or Expo decoded thumbnails.",
    }));
  } catch (error) {
    if (error instanceof FrameSelectionError) {
      console.log(JSON.stringify({ clip: clip.path, error: "No clear Release selected from supplied samples." }));
    } else {
      throw error;
    }
  }
}