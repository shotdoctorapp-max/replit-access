import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const FREE_SHOTS = 3;
const STORAGE_KEY = (userId: string) => `@shotdoc_shots_used_${userId}`;

interface ShotsContextValue {
  shotsRemaining: number;
  shotsUsed: number;
  totalFreeShots: number;
  isLoaded: boolean;
  consumeShot: () => Promise<boolean>;
  isPro: boolean;
}

const ShotsContext = createContext<ShotsContextValue>({
  shotsRemaining: FREE_SHOTS,
  shotsUsed: 0,
  totalFreeShots: FREE_SHOTS,
  isLoaded: false,
  consumeShot: async () => false,
  isPro: false,
});

export function ShotsProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [shotsUsed, setShotsUsed] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const isPro = false;

  useEffect(() => {
    if (!authLoaded) return;
    if (!userId) {
      setShotsUsed(0);
      setIsLoaded(true);
      return;
    }

    AsyncStorage.getItem(STORAGE_KEY(userId)).then((val) => {
      setShotsUsed(val ? parseInt(val, 10) : 0);
      setIsLoaded(true);
    });
  }, [userId, authLoaded]);

  const consumeShot = useCallback(async (): Promise<boolean> => {
    if (isPro) return true;
    if (!userId) return false;
    const remaining = FREE_SHOTS - shotsUsed;
    if (remaining <= 0) return false;

    const next = shotsUsed + 1;
    setShotsUsed(next);
    await AsyncStorage.setItem(STORAGE_KEY(userId), String(next));
    return true;
  }, [userId, shotsUsed, isPro]);

  const shotsRemaining = isPro ? Infinity : Math.max(0, FREE_SHOTS - shotsUsed);

  return (
    <ShotsContext.Provider
      value={{
        shotsRemaining,
        shotsUsed,
        totalFreeShots: FREE_SHOTS,
        isLoaded,
        consumeShot,
        isPro,
      }}
    >
      {children}
    </ShotsContext.Provider>
  );
}

export function useShots() {
  return useContext(ShotsContext);
}
