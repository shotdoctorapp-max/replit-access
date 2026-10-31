import { Platform } from "react-native";
import { planFrameTimes } from "./frameSampling";

export interface ExtractedFrames {
  base64Frames: string[];
  thumbnailUris: string[];
  timestamps: number[];
  coarse: boolean;
  durationMs: number;
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

  // Validate the video is readable
  let videoAccessible = false;
  for (const quality of [0.5, 0.1, 0.3]) {
    try {
      await VideoThumbnails.getThumbnailAsync(localUri, { time: 0, quality });
      videoAccessible = true;
      break;
    } catch {
      continue;
    }
  }

  if (!videoAccessible) {
    throw new Error(
      "Could not open this video. Try exporting it from Photos → Share → Save to Files, then choose Browse Files."
    );
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
      if (!base64 || base64.length > 400_000) {
        throw new Error("Frame exceeds upload size");
      }
      validFrames.push(base64);
      validUris.push(uri);
      validTimestamps.push(time);
    } catch {
      // Dropping a frame would break consistent 10fps context. Fail, do not renumber
      // a sparse sequence and present it as dense sampling.
      throw new Error(`Could not extract the video frame at ${(time / 1000).toFixed(2)}s. Retry with a shorter or lower-resolution clip.`);
    }
  }
  if (validFrames.reduce((sum, frame) => sum + frame.length, 0) > 10_000_000) {
    throw new Error("Video frames exceed the upload limit. Please use a lower-resolution clip.");
  }

  return {
    base64Frames: validFrames,
    thumbnailUris: validUris,
    timestamps: validTimestamps,
    coarse,
    durationMs,
  };
}
