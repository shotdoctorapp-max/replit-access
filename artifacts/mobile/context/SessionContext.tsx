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

export interface DrillRecommendation {
  name: string;
  description: string;
  targetArea: string;
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
}

export interface Session {
  id: string;
  timestamp: string;
  imageUri: string;
  analysis: AnalysisResult;
  isVideo?: boolean;
  bestFrameIndex?: number;
  totalFrames?: number;
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
          const parsed = JSON.parse(raw) as Session[];
          setSessions(parsed);
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
