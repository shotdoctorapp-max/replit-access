import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { componentTierColor, knownTier, TIER_ICONS } from "@/utils/grading";

interface ComponentBarProps {
  label: string;
  score?: number | null;
  feedback: string;
  delay?: number;
}

function LabeledFeedback({ text, color }: { text: string; color: string }) {
  const parts = text.split(/\s*—\s*/);
  if (parts.length >= 2) {
    return (
      <Text style={[styles.bulletText, { color }]}>
        <Text style={styles.bulletLabel}>{parts[0]}</Text>
        {" — "}
        <Text>{parts.slice(1).join(" — ")}</Text>
      </Text>
    );
  }
  return <Text style={[styles.bulletText, { color }]}>{text}</Text>;
}

function parseBullets(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter((s) => s.length > 2);
}

export function ComponentBar({ label, score, feedback, delay = 0 }: ComponentBarProps) {
  const colors = useColors();
  const width = useSharedValue(0);
  const tier = knownTier(score);

  useEffect(() => {
    width.value = withDelay(delay, withTiming(tier && typeof score === "number" ? score / 100 : 0, { duration: 800 }));
  }, [score, delay]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  const barColor = componentTierColor(score);
  const bulletIcon = tier ? TIER_ICONS[tier] as any : "help-circle-outline";
  const bullets = parseBullets(feedback);

  const isElite = tier === "Elite";

  return (
    <View style={[styles.container, { borderColor: barColor + "30", backgroundColor: barColor + "08" }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        <View style={[styles.gradePill, { backgroundColor: barColor + "25", borderColor: barColor }]}>
          {isElite && (
            <MaterialCommunityIcons name="crown" size={11} color={barColor} style={styles.pillIcon} />
          )}
          <Text style={[styles.grade, { color: colors.foreground }]}>{tier ?? "Unscored"}</Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
        <Animated.View style={[styles.fill, barStyle, { backgroundColor: barColor }]} />
      </View>

      <View style={styles.bullets}>
        {bullets.map((point, i) => (
          <View key={i} style={styles.bulletRow}>
            <MaterialCommunityIcons
              name={bulletIcon}
              size={14}
              color={barColor}
              style={styles.bulletIcon}
            />
            <LabeledFeedback text={point} color={colors.foreground} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  gradePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pillIcon: {
    marginRight: 2,
  },
  grade: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  bullets: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  bulletLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  bulletText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    flex: 1,
  },
});
