import { Platform } from "react-native";

export interface ExtractedFrames {
  base64Frames: string[];
  timestamps: number[];
}

const FRAME_COUNT = 8;
const DEFAULT_PROBE_DURATION_MS = 10000;

async function ensureFileUri(
  videoUri: string,
  FileSystem: typeof import("expo-file-system")
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
  const probePoints = [1000, 3000, 8000, 20000, 45000];
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

  return Math.max(3000, lastSuccess + 1000);
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

  let localUri = videoUri;
  try {
    localUri = await ensureFileUri(videoUri, FileSystem);
  } catch {
  }

  try {
    await VideoThumbnails.getThumbnailAsync(localUri, {
      time: 0,
      quality: 0.1,
    });
  } catch (err) {
    throw new Error(
      "Could not open this video file. Please try a different video, or use the photo option instead."
    );
  }

  const captureDuration =
    durationMs && durationMs > 0
      ? durationMs
      : await probeDurationMs(VideoThumbnails, localUri).catch(
          () => DEFAULT_PROBE_DURATION_MS
        );

  const step = Math.max(200, captureDuration / (FRAME_COUNT - 1));
  const timestamps = Array.from({ length: FRAME_COUNT }, (_, i) =>
    Math.round(i * step)
  );

  const results = await Promise.allSettled(
    timestamps.map(async (time) => {
      const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
        time,
        quality: 0.6,
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
      "Could not extract frames from this video. Please try a different video or use the photo option instead."
    );
  }

  return {
    base64Frames: validFrames,
    timestamps: validTimestamps,
  };
}
