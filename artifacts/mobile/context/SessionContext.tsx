import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalysisConfidence, CaptureQuality } from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Stale cache URI cleanup
// ---------------------------------------------------------------------------
// Frames were historically saved to cacheDirectory, which iOS purges under
// storage pressure. On load we check any cache-path URIs and nullify ones
// that no longer exist so the fallback UI (onError icon) renders instead of
// a broken/blank image. documentDirectory URIs are left untouched.
async function cleanStaleCacheUris(
  sessions: Session[]
): Promise<{ sessions: Session[]; changed: boolean }> {
  const FileSystem = await import("expo-file-system/legacy");
  const cacheDir = FileSystem.cacheDirectory ?? "";
  if (!cacheDir) return { sessions, changed: false };

  let changed = false;

  const cleaned = await Promise.all(
    sessions.map(async (s) => {
      let { imageUri, keyFrameUris, ...rest } = s;

      // Check imageUri
      if (imageUri && imageUri.startsWith(cacheDir)) {
        const info = await FileSystem.getInfoAsync(imageUri).catch(() => ({
          exists: false,
        }));
        if (!info.exists) {
          imageUri = "";
          changed = true;
        }
      }

      // Check each keyFrameUri
      if (keyFrameUris && keyFrameUris.length > 0) {
        const checked = await Promise.all(
          keyFrameUris.map(async (uri) => {
            if (uri && uri.startsWith(cacheDir)) {
              const info = await FileSystem.getInfoAsync(uri).catch(() => ({
                exists: false,
              }));
              if (!info.exists) {
                changed = true;
                return "";
              }
            }
            return uri;
          })
        );
        keyFrameUris = checked;
      }

      return { ...rest, imageUri, keyFrameUris };
    })
  );

  return { sessions: cleaned, changed };
}

export interface ComponentScore {
  score: number | null;
  feedback: string;
  adjustments?: string[];
}

export interface FrameAnnotation {
  frameIndex: number;
  zone: string;
  x: number;
  y: number;
  severity: "good" | "warning" | "issue";
  label: string;
}

export interface DrillRecommendation {
  name: string;
  description: string;
  targetArea: string;
}

export interface RhythmAnalysis {
  ballLeavesHandFrame?: number;
  followThroughFrame?: number;
  pattern: "synchronized" | "set-then-drive" | "disconnected" | "unknown";
  dipFrame?: number;
  ballRiseFrame: number;
  bodyRiseFrame: number;
  setPointFrame?: number;
  armExtendFrame: number;
  rhythmScore: number;
  observations: string[];
  adjustments?: string[];
}

export interface AnalysisResult {
  shootingArmSide?: "image-left" | "image-right";
  elbowVisible?: boolean;
  overallScore: number | null;
  summary: string;
  components: {
    stance: ComponentScore;
    hipAlignment: ComponentScore;
    elbowPosition: ComponentScore;
    gripPosition: ComponentScore;
    setPoint: ComponentScore;
    followThrough: ComponentScore;
    balance: ComponentScore;
    eyeTracking: ComponentScore;
  };
  keyStrengths: string[];
  priorityFixes: string[];
  drillRecommendations: DrillRecommendation[];
  annotations?: FrameAnnotation[];
}

export interface Session {
  id: string;
  timestamp: string;
  imageUri: string;
  analysis: AnalysisResult;
  captureQuality?: CaptureQuality;
  confidence?: AnalysisConfidence;
  rhythm?: RhythmAnalysis;
  isVideo?: boolean;
  bestFrameIndex?: number;
  totalFrames?: number;
  keyFrameUris?: string[];
  keyFrameLabels?: string[];
  keyFrameIndices?: number[];
  keyFrameTimestamps?: number[];
  sampledTimestamps?: number[];
  videoUri?: string;
}

interface SessionContextValue {
  sessions: Session[];
  addSession: (session: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  loading: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "hoopform_sessions";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(
              (s) =>
                s &&
                typeof s.id === "string" &&
                typeof s.timestamp === "string" &&
                // imageUri may be "" after stale-cache cleanup — allow that
                typeof s.imageUri === "string" &&
                s.analysis &&
                (typeof s.analysis.overallScore === "number" || s.analysis.overallScore === null) &&
                s.analysis.components &&
                Array.isArray(s.analysis.keyStrengths) &&
                Array.isArray(s.analysis.priorityFixes) &&
                Array.isArray(s.analysis.drillRecommendations)
            ) as Session[];

            // Nullify (set to "") any cacheDirectory URIs whose files are gone.
            // Persists cleaned list so this check only runs once per stale URI.
            const { sessions: cleaned, changed } =
              await cleanStaleCacheUris(valid);
            if (changed) {
              AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(cleaned)
              ).catch(() => {});
            }
            setSessions(cleaned);
          }
        }
      } catch {
        // ignore parse / storage errors
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addSession = useCallback(async (session: Session) => {
    setSessions((prev) => {
      const updated = [session, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(
        () => {}
      );
      return updated;
    });
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(
        () => {}
      );
      return updated;
    });
  }, []);

  return (
    <SessionContext.Provider value={{ sessions, addSession, deleteSession, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessions() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessions must be used within SessionProvider");
  return ctx;
}
