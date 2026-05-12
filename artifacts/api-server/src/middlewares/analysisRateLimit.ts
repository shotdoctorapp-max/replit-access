import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 20;

interface WindowEntry {
  timestamps: number[];
}

const userWindows = new Map<string, WindowEntry>();

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [userId, entry] of userWindows) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) userWindows.delete(userId);
  }
}, WINDOW_MS);

export function analysisRateLimit(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let entry = userWindows.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    userWindows.set(userId, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= MAX_CALLS_PER_WINDOW) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    const retryAfterSecs = Math.ceil(retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSecs));
    res.status(429).json({
      error: `Analysis limit reached. You can make ${MAX_CALLS_PER_WINDOW} analysis requests per hour. Try again in ${Math.ceil(retryAfterSecs / 60)} minute(s).`,
    });
    return;
  }

  entry.timestamps.push(now);
  next();
}
