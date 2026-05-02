import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface ComponentScore {
  score: number;
  feedback: string;
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
  pattern: "synchronized" | "set-then-drive" | "disconnected" | "unknown";
  dipFrame?: number;
  ballRiseFrame: number;
  bodyRiseFrame: number;
  setPointFrame?: number;
  armExtendFrame: number;
  rhythmScore: number;
  observations: string[];
}

export interface AnalysisResult {
  overallScore: number;
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
  rhythm?: RhythmAnalysis;
  isVideo?: boolean;
  bestFrameIndex?: number;
  totalFrames?: number;
  keyFrameUris?: string[];
  keyFrameLabels?: string[];
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
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(
              (s) =>
                s &&
                typeof s.id === "string" &&
                typeof s.timestamp === "string" &&
                typeof s.imageUri === "string" &&
                s.analysis &&
                typeof s.analysis.overallScore === "number" &&
                s.analysis.components &&
                Array.isArray(s.analysis.keyStrengths) &&
                Array.isArray(s.analysis.priorityFixes) &&
                Array.isArray(s.analysis.drillRecommendations)
            ) as Session[];
            setSessions(valid);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
