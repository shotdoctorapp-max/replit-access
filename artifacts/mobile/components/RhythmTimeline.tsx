import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface RhythmData {
  dipFrame?: number;
  ballRiseFrame?: number;
  bodyRiseFrame?: number;
  setPointFrame?: number;
  armExtendFrame?: number;
  pattern?: string;
  rhythmScore?: number;
}

interface Props {
  rhythm: RhythmData;
}

const PHASES: { key: keyof RhythmData; label: string }[] = [
  { key: "dipFrame", label: "Dip" },
  { key: "ballRiseFrame", label: "Ball Up" },
  { key: "bodyRiseFrame", label: "Body Up" },
  { key: "setPointFrame", label: "Set Point" },
  { key: "armExtendFrame", label: "Release" },
];

function getPatternColors(pattern: string | undefined): {
  primary: string;
  badge: string;
  label: string;
  conflictKeys: string[];
} {
  switch (pattern) {
    case "synchronized":
      return { primary: "#22c55e", badge: "#22c55e", label: "✓ Synchronized", conflictKeys: [] };
    case "set-then-drive":
      return { primary: "#22c55e", badge: "#22c55e", label: "✓ Set-then-Drive", conflictKeys: [] };
    case "disconnected":
      return {
        primary: "#f59e0b",
        badge: "#ef4444",
        label: "⚠ Disconnected",
        conflictKeys: ["ballRiseFrame", "bodyRiseFrame"],
      };
    default:
      return { primary: "#6b7280", badge: "#6b7280", label: "Unknown", conflictKeys: [] };
  }
}

export function RhythmTimeline({ rhythm }: Props) {
  const colors = useColors();
  const { primary, badge, label, conflictKeys } = getPatternColors(rhythm.pattern);

  // Collect valid (>= 0) frame indices and find range for proportional layout
  const frameValues = PHASES.map((p) => {
    const v = rhythm[p.key] as number | undefined;
    return typeof v === "number" ? v : -1;
  });

  const validValues = frameValues.filter((v) => v >= 0);
  const minFrame = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxFrame = validValues.length > 1 ? Math.max(...validValues) : minFrame + 1;
  const range = maxFrame - minFrame || 1;

  const getLeft = (frameIdx: number): number => {
    if (frameIdx < 0) return -1; // unclear
    return (frameIdx - minFrame) / range; // 0.0 – 1.0
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.mutedForeground }]}>SHOT TIMELINE</Text>

      {/* Timeline track */}
      <View style={styles.trackWrapper}>
        {/* Connecting line */}
        <View style={[styles.trackLine, { backgroundColor: colors.border }]} />

        {/* Phase dots */}
        {PHASES.map((phase, i) => {
          const rawFrame = rhythm[phase.key] as number | undefined;
          const frameIdx = typeof rawFrame === "number" ? rawFrame : -1;
          const unclear = frameIdx < 0;
          const isConflict = conflictKeys.includes(phase.key);
          const dotColor = unclear ? "#6b7280" : isConflict ? "#ef4444" : primary;
          const leftFraction = unclear ? i / (PHASES.length - 1) : getLeft(frameIdx);

          return (
            <View
              key={phase.key}
              style={[styles.dotWrapper, { left: `${leftFraction * 100}%` as any }]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: dotColor,
                    borderColor: unclear ? "#4b5563" : dotColor + "60",
                    shadowColor: dotColor,
                  },
                ]}
              />
              <Text
                style={[
                  styles.phaseLabel,
                  {
                    color: unclear ? "#6b7280" : colors.foreground,
                    fontStyle: unclear ? "italic" : "normal",
                    opacity: unclear ? 0.6 : 1,
                  },
                ]}
                numberOfLines={1}
              >
                {unclear ? "unclear" : phase.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Pattern badge */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: badge + "20", borderColor: badge + "50" }]}>
          <Text style={[styles.badgeText, { color: badge }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  heading: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 20,
  },
  trackWrapper: {
    height: 56,
    position: "relative",
    marginHorizontal: 14,
  },
  trackLine: {
    position: "absolute",
    top: 9,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  dotWrapper: {
    position: "absolute",
    alignItems: "center",
    transform: [{ translateX: -14 }],
    width: 28,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  phaseLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    textAlign: "center",
    width: 48,
    marginLeft: -10,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});
