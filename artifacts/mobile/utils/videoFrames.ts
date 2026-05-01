import { Platform } from "react-native";

export interface ExtractedFrames {
  base64Frames: string[];
  timestamps: number[];
}

const FRAME_COUNT = 8;
const DEFAULT_PROBE_DURATION_MS = 30000;

async function probeDurationMs(
  VideoThumbnails: typeof import("expo-video-thumbnails"),
  videoUri: string
): Promise<number> {
  const probePoints = [2000, 8000, 20000, 40000, 90000];
  let lastSuccess = 0;

  for (const ts of probePoints) {
    try {
      await VideoThumbnails.getThumbnailAsync(videoUri, { time: ts, quality: 0.05 });
      lastSuccess = ts;
    } catch {
      break;
    }
  }

  return Math.max(4000, lastSuccess + 2000);
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
    import("expo-file-system"),
  ]);

  const captureDuration =
    durationMs && durationMs > 0
      ? durationMs
      : await probeDurationMs(VideoThumbnails, videoUri).catch(
          () => DEFAULT_PROBE_DURATION_MS
        );

  const step = captureDuration / (FRAME_COUNT - 1);
  const timestamps = Array.from({ length: FRAME_COUNT }, (_, i) =>
    Math.round(i * step)
  );

  const results = await Promise.allSettled(
    timestamps.map(async (time) => {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time,
        quality: 0.65,
      });
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { base64, time };
    })
  );

  const validFrames: string[] = [];
  const validTimestamps: number[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      validFrames.push(result.value.base64);
      validTimestamps.push(result.value.time);
    }
  }

  if (validFrames.length === 0) {
    throw new Error(
      "Could not extract any frames from the video. The format may not be supported — try a regular (non-slow-motion) recording, or use the photo option instead."
    );
  }

  return {
    base64Frames: validFrames,
    timestamps: validTimestamps,
  };
}
