import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface ComponentBarProps {
  label: string;
  score: number;
  feedback: string;
  delay?: number;
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

  const barColor =
    score >= 80
      ? colors.success
      : score >= 60
      ? colors.warning
      : colors.destructive;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.score, { color: barColor }]}>{score}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
        <Animated.View
          style={[styles.fill, barStyle, { backgroundColor: barColor }]}
        />
      </View>
      <Text style={[styles.feedback, { color: colors.mutedForeground }]}>
        {feedback}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  score: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  feedback: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
});
