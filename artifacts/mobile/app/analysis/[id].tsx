import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSessions } from "@/context/SessionContext";
import { ScoreRing } from "@/components/ScoreRing";
import { ComponentBar } from "@/components/ComponentBar";
import { DrillCard } from "@/components/DrillCard";
import { scoreToGrade, gradeColor } from "@/utils/grading";

const COMPONENT_LABELS: Record<string, string> = {
  stance: "Stance & Base",
  hipAlignment: "Hip Alignment",
  elbowPosition: "Elbow Position",
  gripPosition: "Grip & Hand",
  setPoint: "Set Point",
  followThrough: "Follow-Through",
  balance: "Balance",
  eyeTracking: "Eye Tracking",
};

const BODY_ZONES = [
  { key: "eyeTracking",    label: "Eye Tracking",  icon: "eye-outline" },
  { key: "setPoint",       label: "Set Point",     icon: "target" },
  { key: "elbowPosition",  label: "Elbow",         icon: "arm-flex-outline" },
  { key: "gripPosition",   label: "Grip & Hand",   icon: "hand-right-outline" },
  { key: "followThrough",  label: "Follow-Thru",   icon: "arrow-up-bold-outline" },
  { key: "hipAlignment",   label: "Hip Alignment", icon: "human" },
  { key: "balance",        label: "Balance",       icon: "scale-balance" },
  { key: "stance",         label: "Stance & Base", icon: "shoe-print" },
];

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions } = useSessions();

  const session = useMemo(() => sessions.find((s) => s.id === id), [sessions, id]);

  if (!session || !session.analysis) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
          Session not found
        </Text>
      </View>
    );
  }

  const { analysis } = session;
  const overallScore = analysis.overallScore ?? 0;
  const scoreColor = gradeColor(overallScore, colors);
  const overallGrade = scoreToGrade(overallScore);

  const sortedComponents = Object.entries(analysis.components ?? {}).sort(
    ([, a], [, b]) => (a?.score ?? 0) - (b?.score ?? 0)
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: session.imageUri }} style={styles.heroImage} />
        <Pressable
          style={[styles.backButton, { backgroundColor: colors.surface1 + "cc" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.imageOverlay}>
          <View style={[styles.scoreBadge, { backgroundColor: colors.surface1 + "ee" }]}>
            <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{overallGrade}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {new Date(session.timestamp).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {session.isVideo && (
            <View style={[styles.videoBadge, { backgroundColor: colors.success + "20", borderColor: colors.success + "50" }]}>
              <Feather name="video" size={11} color={colors.success} />
              <Text style={[styles.videoBadgeText, { color: colors.success }]}>
                Frame {(session.bestFrameIndex ?? 0) + 1}/{session.totalFrames ?? 8}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface1, borderColor: scoreColor + "50" }]}>
          <View style={styles.summaryTop}>
            <ScoreRing score={overallScore} size={80} strokeWidth={7} fontSize={26} />
            <View style={styles.summaryTopRight}>
              <Text style={[styles.overallLabel, { color: colors.mutedForeground }]}>OVERALL GRADE</Text>
              <Text style={[styles.gradeLabel, { color: scoreColor }]}>{overallGrade}</Text>
            </View>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          {analysis.summary
            .split(/(?<=\.)\s+/)
            .map((s) => s.replace(/\.$/, "").trim())
            .filter((s) => s.length > 4)
            .map((point, i) => (
              <View key={i} style={styles.summaryBulletRow}>
                <View style={[styles.summaryDot, { backgroundColor: scoreColor }]} />
                <Text style={[styles.summaryBulletText, { color: colors.foreground }]}>{point}</Text>
              </View>
            ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="human" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BODY MAP</Text>
          </View>
          <View style={styles.bodyMapGrid}>
            {BODY_ZONES.map(({ key, label, icon }) => {
              const component = analysis.components?.[key as keyof typeof analysis.components];
              const score = component?.score ?? 0;
              const zoneColor =
                score >= 75
                  ? colors.success
                  : score >= 50
                  ? colors.warning
                  : colors.destructive;
              return (
                <View
                  key={key}
                  style={[
                    styles.bodyZoneCard,
                    {
                      backgroundColor: zoneColor + "15",
                      borderColor: zoneColor + "50",
                    },
                  ]}
                >
                  <View style={[styles.bodyZoneScoreBadge, { backgroundColor: zoneColor }]}>
                    <Text style={styles.bodyZoneScoreText}>{scoreToGrade(score)}</Text>
                  </View>
                  <MaterialCommunityIcons name={icon as any} size={22} color={zoneColor} style={styles.bodyZoneIcon} />
                  <Text style={[styles.bodyZoneLabel, { color: colors.foreground }]} numberOfLines={2}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="star" size={16} color={colors.success} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>STRENGTHS</Text>
          </View>
          {(analysis.keyStrengths ?? []).map((s, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.bulletText, { color: colors.foreground }]}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={colors.warning} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PRIORITY FIXES</Text>
          </View>
          {(analysis.priorityFixes ?? []).map((f, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.dot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.bulletText, { color: colors.foreground }]}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BIOMECHANICAL BREAKDOWN</Text>
          {sortedComponents.map(([key, value], i) => (
            <ComponentBar
              key={key}
              label={COMPONENT_LABELS[key] ?? key}
              score={value.score}
              feedback={value.feedback}
              delay={i * 80}
            />
          ))}
        </View>

        {(analysis.drillRecommendations ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECOMMENDED DRILLS</Text>
            {(analysis.drillRecommendations ?? []).map((drill, i) => (
              <DrillCard key={`${drill.name}-${i}`} drill={drill} index={i} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  videoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  videoBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  imageContainer: {
    position: "relative",
    height: 300,
  },
  heroImage: {
    width: "100%",
    height: 300,
    resizeMode: "cover",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 16,
    right: 16,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 2,
  },
  scoreBadgeText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  scoreBadgeSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  date: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  summaryTopRight: {
    flex: 1,
    gap: 2,
  },
  overallLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
  gradeLabel: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    lineHeight: 48,
  },
  summaryDivider: {
    height: 1,
    marginVertical: 2,
  },
  summaryBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 7,
    flexShrink: 0,
  },
  summaryBulletText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    flex: 1,
  },
  section: { marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    flex: 1,
  },
  bodyMapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  bodyZoneCard: {
    width: "47%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    position: "relative",
    minHeight: 80,
    justifyContent: "center",
    gap: 4,
  },
  bodyZoneScoreBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 10,
    minWidth: 28,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: "center",
  },
  bodyZoneScoreText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  bodyZoneIcon: {
    marginBottom: 2,
  },
  bodyZoneLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 14,
  },
});
