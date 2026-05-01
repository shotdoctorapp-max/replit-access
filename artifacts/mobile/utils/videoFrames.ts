import * as FileSystem from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";

export interface ExtractedFrames {
  base64Frames: string[];
  timestamps: number[];
}

const FRAME_COUNT = 8;
const CAPTURE_DURATION_MS = 4000;

export async function extractFrames(
  videoUri: string,
  durationMs?: number
): Promise<ExtractedFrames> {
  if (Platform.OS === "web") {
    throw new Error("Video frame extraction is not supported on web. Please use the photo option.");
  }

  const captureDuration = durationMs ?? CAPTURE_DURATION_MS;
  const step = captureDuration / (FRAME_COUNT - 1);
  const timestamps = Array.from({ length: FRAME_COUNT }, (_, i) =>
    Math.round(i * step)
  );

  const base64Frames: string[] = [];

  await Promise.all(
    timestamps.map(async (time) => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time,
          quality: 0.65,
        });
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        base64Frames[timestamps.indexOf(time)] = base64;
      } catch {
        base64Frames[timestamps.indexOf(time)] = "";
      }
    })
  );

  const validFrames = base64Frames.filter(Boolean);

  if (validFrames.length === 0) {
    throw new Error("Could not extract any frames from the video.");
  }

  return {
    base64Frames: validFrames,
    timestamps: timestamps.slice(0, validFrames.length),
  };
}
