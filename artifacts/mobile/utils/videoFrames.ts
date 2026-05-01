import { Platform } from "react-native";

export interface ExtractedFrames {
  base64Frames: string[];
  timestamps: number[];
}

const FRAME_COUNT = 8;

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

async function probeDurationMs(
  VideoThumbnails: typeof import("expo-video-thumbnails"),
  videoUri: string
): Promise<number> {
  const probePoints = [500, 1000, 2000, 5000, 10000, 20000, 45000];
  let lastSuccess = 0;

  for (const ts of probePoints) {
    try {
      await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: ts,
        quality: 0.05,
      });
      lastSuccess = ts;
    } catch {
      break;
    }
  }

  return Math.max(1000, lastSuccess + 500);
}

export async function extractFrames(
  videoUri: string,
  durationMs?: number
): Promise<ExtractedFrames> {
  if (Platform.OS === "web") {
    throw new Error(
      "Video frame extraction is not supported on web. Please use the photo option."
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

  // Validate the video is readable at all — try both quality levels
  let videoAccessible = false;
  for (const quality of [0.5, 0.1, 0.3]) {
    try {
      await VideoThumbnails.getThumbnailAsync(localUri, {
        time: 0,
        quality,
      });
      videoAccessible = true;
      break;
    } catch {
      continue;
    }
  }

  if (!videoAccessible) {
    throw new Error(
      "Could not open this video. Please try recording directly with the 'Record Shot' button, or use the photo option instead."
    );
  }

  // Use provided duration, otherwise probe
  const captureDuration =
    durationMs && durationMs > 500
      ? durationMs
      : await probeDurationMs(VideoThumbnails, localUri);

  const step = Math.max(150, captureDuration / (FRAME_COUNT - 1));
  const timestamps = Array.from({ length: FRAME_COUNT }, (_, i) =>
    Math.round(i * step)
  );

  const results = await Promise.allSettled(
    timestamps.map(async (time) => {
      const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
        time,
        quality: 0.65,
      });
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });
      return { base64, time };
    })
  );

  const validFrames: string[] = [];
  const validTimestamps: number[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      validFrames.push(result.value.base64);
      validTimestamps.push(result.value.time);
    } else {
      errors.push(result.reason?.message ?? "unknown");
    }
  }

  if (validFrames.length === 0) {
    const detail = errors.length > 0 ? ` (${errors[0]})` : "";
    throw new Error(
      `Could not extract frames from this video${detail}. Please try a different clip or use the photo option instead.`
    );
  }

  return {
    base64Frames: validFrames,
    timestamps: validTimestamps,
  };
}
