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
import { scoreToGrade, gradeColor } from "@/utils/grading";

interface ComponentBarProps {
  label: string;
  score: number;
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

  useEffect(() => {
    width.value = withDelay(delay, withTiming(score / 100, { duration: 800 }));
  }, [score, delay]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  const barColor = gradeColor(score, colors);
  const grade = scoreToGrade(score);
  const bullets = parseBullets(feedback);
  const bulletIcon =
    score >= 70 ? "check-circle-outline" : score >= 55 ? "alert-circle-outline" : "arrow-right-circle-outline";

  return (
    <View style={[styles.container, { borderColor: barColor + "30", backgroundColor: barColor + "08" }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        <View style={[styles.gradePill, { backgroundColor: barColor + "25", borderColor: barColor + "60" }]}>
          <Text style={[styles.grade, { color: barColor }]}>{grade}</Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
        <Animated.View style={[styles.fill, barStyle, { backgroundColor: barColor }]} />
      </View>

      <View style={styles.bullets}>
        {bullets.map((point, i) => (
          <View key={i} style={styles.bulletRow}>
            <MaterialCommunityIcons
              name={bulletIcon as any}
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
  },
  grade: {
    fontSize: 14,
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
