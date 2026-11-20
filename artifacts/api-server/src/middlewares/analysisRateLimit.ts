import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 20;
// One video analysis makes up to three phase requests (locate, prepare,
// refine-release) before the final "analyze" request. Only the final request
// counts as an analysis; phase requests get their own, proportionally larger
// budget so they still cannot be abused for unlimited provider calls.
const MAX_PHASE_CALLS_PER_WINDOW = MAX_CALLS_PER_WINDOW * 4;
const PHASE_MODES = new Set(["locate", "prepare", "refine-release"]);

interface WindowEntry {
  timestamps: number[];
}

const userWindows = new Map<string, WindowEntry>();
const phaseWindows = new Map<string, WindowEntry>();

const sweep = setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const windows of [userWindows, phaseWindows]) {
    for (const [userId, entry] of windows) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) windows.delete(userId);
    }
  }
}, WINDOW_MS);
// Don't keep a process (tests, scripts) alive just for the cleanup timer.
(sweep as { unref?: () => void }).unref?.();

export function analysisRateLimit(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ ok: false, code: "AUTH_REQUIRED", error: "Your sign-in expired. Please sign in again and retry." });
    return;
  }

  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const mode = (req.body as { mode?: unknown } | undefined)?.mode;
  const isPhaseRequest = typeof mode === "string" && PHASE_MODES.has(mode);
  const windows = isPhaseRequest ? phaseWindows : userWindows;
  const limit = isPhaseRequest ? MAX_PHASE_CALLS_PER_WINDOW : MAX_CALLS_PER_WINDOW;

  let entry = windows.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(userId, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    const retryAfterSecs = Math.ceil(retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSecs));
    res.status(429).json({
      ok: false,
      code: "ANALYSIS_RATE_LIMIT",
      error: `Analysis limit reached. You can analyze ${MAX_CALLS_PER_WINDOW} videos per hour. Try again in ${Math.ceil(retryAfterSecs / 60)} minute(s).`,
    });
    return;
  }

  entry.timestamps.push(now);
  next();
}
