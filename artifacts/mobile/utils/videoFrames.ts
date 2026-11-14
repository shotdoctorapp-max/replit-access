import { Platform } from "react-native";
import { NoReadableFramesError, planFrameTimes } from "./frameSampling";

export interface ExtractedFrames {
  base64Frames: string[];
  thumbnailUris: string[];
  timestamps: number[];
  coarse: boolean;
  durationMs: number;
  incomplete?: boolean;
}

async function ensureFileUri(
  videoUri: string,
  FileSystem: typeof import("expo-file-system/legacy")
): Promise<string> {
  if (
    videoUri.startsWith("ph://") ||
    videoUri.startsWith("assets-library://")
  ) {
    const destUri = `${FileSystem.cacheDirectory}shotdoc_video_${Date.now()}.mp4`;
    await FileSystem.copyAsync({ from: videoUri, to: destUri });
    return destUri;
  }
  return videoUri;
}

export async function extractFrames(
  videoUri: string,
  durationMs?: number,
  anchorMs?: number,
  requestedTimes?: number[],
): Promise<ExtractedFrames> {
  if (Platform.OS === "web") {
    throw new Error(
      "Open Shot Doctor on your iPhone or Android device to analyze a video."
    );
  }

  const [VideoThumbnails, FileSystem] = await Promise.all([
    import("expo-video-thumbnails"),
    import("expo-file-system/legacy"),
  ]);

  let localUri = videoUri;
  try {
    localUri = await ensureFileUri(videoUri, FileSystem);
  } catch {
    // keep original URI if copy fails
  }

  // Files-picker assets have no duration. Read real native metadata rather than
  // guessing from thumbnail probes (which can succeed beyond EOF).
  if (!durationMs || !Number.isFinite(durationMs)) {
    const { createVideoPlayer } = await import("expo-video");
    const player = createVideoPlayer(null);
    try {
      durationMs = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Video metadata timed out. Please retry with a local clip.")); }, 15_000);
        const loaded = player.addListener("sourceLoad", event => { cleanup(); resolve(event.duration * 1000); });
        const status = player.addListener("statusChange", event => {
          if (event.status === "error") { cleanup(); reject(new Error("Could not read video duration. Please try another clip.")); }
        });
        function cleanup() { clearTimeout(timeout); loaded.remove(); status.remove(); }
        player.replaceAsync(localUri).catch(() => { cleanup(); reject(new Error("Could not load video metadata. Please retry.")); });
      });
    } finally {
      player.release();
    }
  }
  const { timestamps, coarse } = requestedTimes
    ? { timestamps: requestedTimes, coarse: false }
    : planFrameTimes(durationMs, anchorMs);
  const validFrames: string[] = [];
  const validUris: string[] = [];
  const validTimestamps: number[] = [];
  let totalBytes = 0;
  let incomplete = false;
  // Sequential extraction bounds native memory usage; all arrays are appended together.
  for (const time of timestamps) {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
        time,
        quality: 0.35,
      });
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });
      if (!base64 || base64.length > 400_000 || totalBytes + base64.length > 10_000_000) {
        throw new Error("Frame exceeds upload size");
      }
      validFrames.push(base64);
      validUris.push(uri);
      validTimestamps.push(time);
      totalBytes += base64.length;
    } catch {
      // Preserve actual requested times and mark sparse evidence. The pipeline
      // must not send this as consecutive 10fps/33ms phase-selection footage.
      incomplete = true;
    }
  }
  if (validFrames.length === 0) {
    throw new NoReadableFramesError("No readable video frames were available. Try exporting the video from Photos to Files.");
  }

  return {
    base64Frames: validFrames,
    thumbnailUris: validUris,
    timestamps: validTimestamps,
    coarse,
    durationMs,
    incomplete,
  };
}
