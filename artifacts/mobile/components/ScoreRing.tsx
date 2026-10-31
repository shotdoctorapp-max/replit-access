import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { scoreToTier, tierColor } from "@/utils/grading";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ScoreRingProps {
  score?: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  fontSize?: number;
}

export function ScoreRing({
  score,
  size = 100,
  strokeWidth = 8,
  label,
  fontSize = 28,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);
  const validScore = scoreToTier(score).score;

  useEffect(() => {
    progress.value = withTiming(validScore === null ? 0 : validScore / 100, { duration: 1200 });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const ringCol = tierColor(score);
  const tier = scoreToTier(score).label;

  // Scale down font for the score number to leave room for tier name
  const scoreFontSize = Math.round(fontSize * 0.72);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1a1a1a"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringCol}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={[styles.center, { width: size - strokeWidth * 2 - 4 }]}>
        <Text
          style={[styles.score, { color: ringCol, fontSize: scoreFontSize }]}
          numberOfLines={1}
        >
          {validScore === null ? "—" : Math.round(validScore)}
        </Text>
        <Text
          style={[styles.tier, { color: ringCol }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {tier}
        </Text>
        {label && (
          <Text style={[styles.label, { color: "#606060" }]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    position: "absolute",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontFamily: "Inter_700Bold",
    lineHeight: undefined,
  },
  tier: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 13,
  },
  label: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 1,
  },
});
