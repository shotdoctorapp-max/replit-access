import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useSessions, type RhythmAnalysis } from "@/context/SessionContext";
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

// Normalized positions for a right-handed shooter roughly centered in frame.
// anchor "right" → pos = left% value; dot placed at left:pos%, tag extends rightward
// anchor "left"  → pos = right% value from right edge; dot is at the right end of the row,
//                  tag extends leftward. right:pos% → dot at (1-pos)% from left.
// Upper body stacks on the right side of the player; lower body on the left of center.
const ZONE_POSITIONS: Record<string, { pos: number; top: number; anchor: "left" | "right" }> = {
  eyeTracking:   { pos: 0.58, top: 0.13, anchor: "right" },
  setPoint:      { pos: 0.62, top: 0.22, anchor: "right" },
  followThrough: { pos: 0.64, top: 0.30, anchor: "right" },
  gripPosition:  { pos: 0.60, top: 0.38, anchor: "right" },
  elbowPosition: { pos: 0.63, top: 0.46, anchor: "right" },
  hipAlignment:  { pos: 0.42, top: 0.60, anchor: "left"  },
  balance:       { pos: 0.42, top: 0.71, anchor: "left"  },
  stance:        { pos: 0.42, top: 0.82, anchor: "left"  },
};

const ZONE_SHORT: Record<string, string> = {
  eyeTracking:   "Eyes",
  setPoint:      "Set Point",
  gripPosition:  "Grip",
  elbowPosition: "Elbow",
  followThrough: "Release",
  hipAlignment:  "Hips",
  balance:       "Balance",
  stance:        "Stance",
};

const BODY_ZONES = [
  { key: "eyeTracking",    label: "Eye Tracking",  icon: "eye-outline" },
  { key: "setPoint",       label: "Set Point",     icon: "target" },
  { key: "elbowPosition",  label: "Elbow",         icon: "arm-flex" },
  { key: "gripPosition",   label: "Grip & Hand",   icon: "gesture-tap" },
  { key: "followThrough",  label: "Follow-Thru",   icon: "arrow-up-bold-outline" },
  { key: "hipAlignment",   label: "Hip Alignment", icon: "human" },
  { key: "balance",        label: "Balance",       icon: "scale-balance" },
  { key: "stance",         label: "Stance & Base", icon: "shoe-print" },
];

const PATTERN_META: Record<
  RhythmAnalysis["pattern"],
  { label: string; icon: string; colorKey: "success" | "warning" | "destructive" | "primary" }
> = {
  "synchronized":   { label: "Synchronized ✓",   icon: "sync",           colorKey: "success"     },
  "set-then-drive": { label: "Set → Drive ✓",    icon: "arrow-up-bold",  colorKey: "primary"     },
  "disconnected":   { label: "Disconnected ✗",   icon: "alert-circle",   colorKey: "destructive" },
  "unknown":       { label: "Undetermined",     icon: "help-circle",    colorKey: "warning"     },
};

const RHYTHM_ROWS: { key: keyof Pick<RhythmAnalysis, "ballRiseFrame" | "bodyRiseFrame" | "armExtendFrame">; label: string; icon: string }[] = [
  { key: "bodyRiseFrame",  label: "Legs / Hips",  icon: "run-fast" },
  { key: "ballRiseFrame",  label: "Ball Rise",     icon: "basketball"      },
  { key: "armExtendFrame", label: "Arm Extend",    icon: "arm-flex"        },
];

function RhythmSection({ rhythm, totalFrames }: { rhythm: RhythmAnalysis; totalFrames: number }) {
  const colors = useColors();
  const meta = PATTERN_META[rhythm.pattern] ?? PATTERN_META["unknown"];
  const patternColor = colors[meta.colorKey];
  const rhythmGrade = scoreToGrade(rhythm.rhythmScore ?? 0);
  const frames = Math.max(totalFrames, 1);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <MaterialCommunityIcons name="timer-outline" size={16} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SHOT RHYTHM</Text>
      </View>

      {/* Pattern badge + grade */}
      <View style={[styles.rhythmHeader, { backgroundColor: patternColor + "15", borderColor: patternColor + "40" }]}>
        <MaterialCommunityIcons name={meta.icon as any} size={22} color={patternColor} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rhythmPatternLabel, { color: patternColor }]}>{meta.label}</Text>
          <Text style={[styles.rhythmPatternSub, { color: colors.mutedForeground }]}>Kinetic chain sequencing</Text>
        </View>
        <View style={[styles.rhythmGradePill, { backgroundColor: patternColor + "25", borderColor: patternColor + "60" }]}>
          <Text style={[styles.rhythmGradeText, { color: patternColor }]}>{rhythmGrade}</Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={[styles.rhythmTimeline, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
        <Text style={[styles.rhythmTimelineTitle, { color: colors.mutedForeground }]}>MOVEMENT SEQUENCE</Text>
        {RHYTHM_ROWS.map(({ key, label, icon }) => {
          const frameIdx = rhythm[key];
          const hasData = frameIdx >= 0;
          const pct = hasData ? frameIdx / (frames - 1) : null;
          return (
            <View key={key} style={styles.rhythmRow}>
              <MaterialCommunityIcons name={icon as any} size={14} color={colors.mutedForeground} style={styles.rhythmRowIcon} />
              <Text style={[styles.rhythmRowLabel, { color: colors.foreground }]}>{label}</Text>
              <View style={[styles.rhythmTrack, { backgroundColor: colors.surface3 }]}>
                {pct !== null && (
                  <View
                    style={[
                      styles.rhythmDot,
                      { left: `${Math.round(pct * 88)}%`, backgroundColor: colors.primary },
                    ]}
                  />
                )}
                {/* Frame tick marks */}
                {Array.from({ length: frames }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.rhythmTick,
                      { left: `${Math.round((i / (frames - 1)) * 100)}%`, backgroundColor: colors.surface3 },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.rhythmFrameNum, { color: colors.mutedForeground }]}>
                {hasData ? `F${frameIdx + 1}` : "—"}
              </Text>
            </View>
          );
        })}
        <View style={styles.rhythmLegend}>
          <Text style={[styles.rhythmLegendText, { color: colors.mutedForeground }]}>Start →</Text>
          <Text style={[styles.rhythmLegendText, { color: colors.mutedForeground }]}>Release</Text>
        </View>
      </View>

      {/* Observations */}
      <View style={styles.rhythmObs}>
        {(rhythm.observations ?? []).map((obs, i) => (
          <View key={i} style={styles.bulletRow}>
            <MaterialCommunityIcons name="chevron-right" size={14} color={colors.primary} style={{ marginTop: 3 }} />
            <Text style={[styles.bulletText, { color: colors.foreground }]}>{obs}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

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
  const [heroUri, setHeroUri] = useState(session.imageUri);
  const [activeFrameIdx, setActiveFrameIdx] = useState<number | null>(null);

  const hasKeyFrames =
    session.isVideo &&
    session.keyFrameUris &&
    session.keyFrameUris.length > 1;

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
        <Image source={{ uri: heroUri }} style={styles.heroImage} />

        {/* Body zone annotation markers — shown for zones scoring below 75 */}
        {Object.entries(analysis.components ?? {}).map(([key, comp]) => {
          const pos = ZONE_POSITIONS[key];
          if (!pos || !comp || comp.score >= 75) return null;
          const markerColor = gradeColor(comp.score, colors);
          const label = ZONE_SHORT[key] ?? key;
          const isRight = pos.anchor === "right";
          const posStyle = isRight
            ? { left: `${pos.pos * 100}%` as const, top: `${pos.top * 100}%` as const }
            : { right: `${pos.pos * 100}%` as const, top: `${pos.top * 100}%` as const };
          const dot = (
            <View style={[styles.annotationDot, { backgroundColor: markerColor, shadowColor: markerColor }]} />
          );
          const tag = (
            <View style={[styles.annotationTag, { backgroundColor: markerColor + "ee" }]}>
              <Text style={styles.annotationTagText}>{label}</Text>
            </View>
          );
          return (
            <View key={key} style={[styles.annotationMarker, posStyle]} pointerEvents="none">
              {isRight ? <>{dot}{tag}</> : <>{tag}{dot}</>}
            </View>
          );
        })}

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

      {hasKeyFrames && (
        <View style={[styles.frameStripContainer, { backgroundColor: colors.surface1, borderBottomColor: colors.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.frameStrip}
          >
            {(session.keyFrameUris ?? []).map((uri, i) => {
              const label = session.keyFrameLabels?.[i] ?? `Frame ${i + 1}`;
              const isActive = activeFrameIdx === i;
              return (
                <Pressable
                  key={i}
                  style={styles.frameThumbWrapper}
                  onPress={() => {
                    setHeroUri(uri);
                    setActiveFrameIdx(i);
                  }}
                >
                  <View style={[
                    styles.frameThumb,
                    { borderColor: isActive ? colors.primary : colors.border },
                  ]}>
                    <Image source={{ uri }} style={styles.frameThumbImg} />
                    {isActive && (
                      <View style={[styles.frameThumbActive, { backgroundColor: colors.primary + "33" }]} />
                    )}
                  </View>
                  <Text style={[
                    styles.frameThumbLabel,
                    { color: isActive ? colors.primary : colors.mutedForeground },
                  ]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

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
            .map((point, i) => {
              const parts = point.split(/\s*—\s*/);
              const accentColor = i === 0 ? colors.primary : scoreColor;
              return (
                <View
                  key={i}
                  style={[
                    styles.summaryBulletRow,
                    { borderLeftColor: accentColor, borderLeftWidth: 3, paddingLeft: 10 },
                  ]}
                >
                  {parts.length >= 2 ? (
                    <Text style={[styles.summaryBulletText, { color: colors.foreground }]}>
                      <Text style={styles.summaryBulletLabel}>{parts[0]}</Text>
                      {" — "}
                      <Text>{parts.slice(1).join(" — ")}</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.summaryBulletText, { color: colors.foreground }]}>{point}</Text>
                  )}
                </View>
              );
            })}
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

        {session.rhythm && <RhythmSection rhythm={session.rhythm} totalFrames={session.totalFrames ?? 8} />}

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
  frameStripContainer: {
    borderBottomWidth: 1,
  },
  frameStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  frameThumbWrapper: {
    alignItems: "center",
    gap: 5,
  },
  frameThumb: {
    width: 72,
    height: 96,
    borderRadius: 8,
    borderWidth: 2,
    overflow: "hidden",
  },
  frameThumbImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  frameThumbActive: {
    position: "absolute",
    inset: 0,
  },
  frameThumbLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  annotationMarker: {
    position: "absolute",
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  annotationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  annotationTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  annotationTagText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
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
    marginVertical: 4,
  },
  summaryBulletLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
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
  rhythmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  rhythmPatternLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  rhythmPatternSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  rhythmGradePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  rhythmGradeText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  rhythmTimeline: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  rhythmTimelineTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  rhythmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rhythmRowIcon: {
    flexShrink: 0,
  },
  rhythmRowLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    width: 70,
  },
  rhythmTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
  },
  rhythmDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: -3,
    marginLeft: -7,
  },
  rhythmTick: {
    position: "absolute",
    width: 1,
    height: 8,
    top: 0,
    opacity: 0.3,
  },
  rhythmFrameNum: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    width: 22,
    textAlign: "right",
  },
  rhythmLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  rhythmLegendText: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  rhythmObs: {
    gap: 6,
  },
});
