import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSessions } from "@/context/SessionContext";
import { DrillCard } from "@/components/DrillCard";
import type { DrillRecommendation } from "@/context/SessionContext";

const DEFAULT_DRILLS: DrillRecommendation[] = [
  {
    name: "Wall Shadow Shooting",
    description: "Stand 2 feet from a wall, practice your shot without a ball focusing on elbow alignment and follow-through extension.",
    targetArea: "elbowPosition",
  },
  {
    name: "One-Hand Form Shooting",
    description: "Shoot with your shooting hand only from 3-5 feet. Forces proper wrist snap and finger-tip release mechanics.",
    targetArea: "followThrough",
  },
  {
    name: "Wide Stance Balance Drill",
    description: "Set up in an exaggerated wide stance, freeze at your shooting peak for 3 seconds to build balance awareness.",
    targetArea: "balance",
  },
  {
    name: "Chair Sit Shooting",
    description: "Sit on the edge of a chair, shoot straight up. Isolates upper body mechanics and removes leg interference.",
    targetArea: "setPoint",
  },
  {
    name: "Tennis Ball Grip Drill",
    description: "Hold a tennis ball in your guide hand while shooting. Prevents palming and teaches proper guide hand placement.",
    targetArea: "gripPosition",
  },
  {
    name: "Mirror Stance Check",
    description: "Practice your stance and setup in front of a mirror for 5 minutes daily. Hip alignment and foot positioning focus.",
    targetArea: "stance",
  },
];

const BIOMECHANICS_TIPS = [
  {
    icon: "arm-flex" as const,
    title: "The 90° Elbow Rule",
    body: "Your shooting elbow should form a 90° angle at the set point. This creates a consistent release plane and improves arc trajectory.",
  },
  {
    icon: "human-handsup" as const,
    title: "Hip Loading for Power",
    body: "Power in a jump shot comes from hip extension, not arm force. Proper hip loading creates a smooth energy transfer through the kinetic chain.",
  },
  {
    icon: "eye" as const,
    title: "Target Lock",
    body: "Fix your eyes on the front rim — not the ball — from your set point through release. This improves depth perception and release timing.",
  },
  {
    icon: "hand-back-left" as const,
    title: "Guide Hand Discipline",
    body: "The guide hand is a shelf, not a shooter. It should come off the ball at release with zero lateral force. Practice with a folded towel under your guide armpit.",
  },
];

export default function TipsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions } = useSessions();

  const personalizedDrills = useMemo(() => {
    if (sessions.length === 0) return DEFAULT_DRILLS;

    const avgComponents: Record<string, number> = {};
    const componentKeys = Object.keys(sessions[0].analysis.components) as Array<
      keyof typeof sessions[0]["analysis"]["components"]
    >;

    for (const key of componentKeys) {
      avgComponents[key] = Math.round(
        sessions.reduce((acc, s) => acc + s.analysis.components[key].score, 0) / sessions.length
      );
    }

    const allDrills = sessions.flatMap((s) => s.analysis.drillRecommendations);
    const seen = new Set<string>();
    const unique = allDrills.filter((d) => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });

    return unique.length >= 3 ? unique.slice(0, 6) : [...unique, ...DEFAULT_DRILLS].slice(0, 6);
  }, [sessions]);

  const weakestArea =
    sessions.length > 0
      ? Object.entries(sessions[sessions.length > 1 ? sessions.length - 1 : 0].analysis.components).sort(
          ([, a], [, b]) => a.score - b.score
        )[0]
      : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Coaching Tips</Text>

      {weakestArea && (
        <View style={[styles.focusCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
          <MaterialCommunityIcons name="target" size={20} color={colors.primary} />
          <View style={styles.focusText}>
            <Text style={[styles.focusLabel, { color: colors.primary }]}>FOCUS AREA</Text>
            <Text style={[styles.focusArea, { color: colors.foreground }]}>
              {weakestArea[0].replace(/([A-Z])/g, " $1").trim()}
            </Text>
            <Text style={[styles.focusScore, { color: colors.mutedForeground }]}>
              Score: {weakestArea[1].score}/100
            </Text>
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {sessions.length > 0 ? "YOUR DRILL PROGRAM" : "STARTER DRILLS"}
      </Text>
      {personalizedDrills.map((drill, i) => (
        <DrillCard key={`${drill.name}-${i}`} drill={drill} index={i} />
      ))}

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>
        BIOMECHANICS FUNDAMENTALS
      </Text>
      {BIOMECHANICS_TIPS.map((tip) => (
        <View
          key={tip.title}
          style={[styles.tipCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}
        >
          <View style={[styles.tipIcon, { backgroundColor: colors.accent + "20" }]}>
            <MaterialCommunityIcons name={tip.icon} size={20} color={colors.accent} />
          </View>
          <View style={styles.tipContent}>
            <Text style={[styles.tipTitle, { color: colors.foreground }]}>{tip.title}</Text>
            <Text style={[styles.tipBody, { color: colors.mutedForeground }]}>{tip.body}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 20,
  },
  focusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  focusText: { flex: 1 },
  focusLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  focusArea: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textTransform: "capitalize",
  },
  focusScore: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  tipCard: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  tipIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipContent: { flex: 1 },
  tipTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  tipBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
