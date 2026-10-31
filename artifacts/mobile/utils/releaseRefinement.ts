/** Requested native seeks, not decoded source-frame PTS. No percentage/index fallback. */
export function planReleaseTimes(anchor: number, duration: number, setPointTime: number) {
  if (![anchor, duration, setPointTime].every(Number.isFinite) || anchor <= setPointTime || duration <= anchor) {
    throw new Error("Invalid Release refinement window.");
  }
  const times = Array.from({ length: 11 }, (_, i) => Math.round(anchor - 100 + i * 33))
    .filter(t => t >= 0 && t > setPointTime && t <= duration - 50);
  if (times.length < 3) throw new Error("Not enough footage after Set Point to verify the wrist flick.");
  return times;
}

type Frames = { timestamps: number[]; thumbnailUris: string[]; base64Frames: string[] };
export function mergeRefinedRelease(original: Frames, phases: number[], fine: Frames, selected: number) {
  if (phases.length !== 3 || phases.some((v, i) => !Number.isInteger(v) || v < 0 ||
      v >= original.timestamps.length || (i > 0 && v <= phases[i - 1])) ||
      !Number.isInteger(selected) || selected < 0 || selected >= fine.timestamps.length) {
    throw new Error("Release refinement could not be matched to the supplied video frames.");
  }
  const time = fine.timestamps[selected];
  if (time <= original.timestamps[phases[1]]) throw new Error("Release must follow Set Point.");
  const entries = original.timestamps.flatMap((timestamp, i) =>
    i === phases[2] || timestamp === time ? [] : [{ timestamp,
      uri: original.thumbnailUris[i], base64: original.base64Frames[i],
      phase: i === phases[0] ? "dip" : i === phases[1] ? "set" : "" }]);
  entries.push({ timestamp: time, uri: fine.thumbnailUris[selected], base64: fine.base64Frames[selected], phase: "release" });
  entries.sort((a, b) => a.timestamp - b.timestamp);
  const phaseIndices = ["dip", "set", "release"].map(phase => entries.findIndex(e => e.phase === phase));
  if (phaseIndices.some((n, i) => n < 0 || (i > 0 && n <= phaseIndices[i - 1])) ||
      entries.some(e => !e.uri || !e.base64) || entries.length > 48) {
    throw new Error("Refined phase evidence is incomplete.");
  }
  return { timestamps: entries.map(e => e.timestamp), thumbnailUris: entries.map(e => e.uri),
    base64Frames: entries.map(e => e.base64), phaseIndices };
}
