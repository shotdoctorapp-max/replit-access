import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FeedbackSheet, FEEDBACK_SUPPRESSED_KEY } from "@/components/FeedbackSheet";
import {
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSessions, type RhythmAnalysis, type FrameAnnotation } from "@/context/SessionContext";
import { ScoreRing } from "@/components/ScoreRing";
import { ComponentBar } from "@/components/ComponentBar";
import { DrillCard } from "@/components/DrillCard";
import { RhythmTimeline } from "@/components/RhythmTimeline";
import { FrameAnnotationOverlay } from "@/components/FrameAnnotationOverlay";
import { scoreToTier, tierColor, TIER_ICONS, TIER_COLORS, UNSCORED_COLOR, knownTier, componentTierColor, frameTierSummary, scoreSeverity } from "@/utils/grading";

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

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.notificationDot,
        { backgroundColor: color, transform: [{ scale }], opacity },
      ]}
    />
  );
}

function RhythmSection({ rhythm, sessionId }: { rhythm: RhythmAnalysis; sessionId: string }) {
  const colors = useColors();
  const meta = PATTERN_META[rhythm.pattern] ?? PATTERN_META["unknown"];
  const patternColor = colors[meta.colorKey];
  const rhythmTier = scoreToTier(rhythm.rhythmScore).label;
  // Use last observation as the coaching cue (most actionable sentence)
  const obs = rhythm.observations ?? [];
  const coachingCue = obs[obs.length - 1] ?? null;
  const adjustments: string[] = scoreToTier(rhythm.rhythmScore).needsWork ? (rhythm.adjustments ?? []) : [];

  const adjStorageKey = `hoopform_rhythm_adj_done_${sessionId}`;
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(adjStorageKey)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setDoneSteps(new Set(parsed));
        }
      })
      .catch(() => {});
  }, [adjStorageKey]);

  const toggleStep = useCallback((key: string) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      AsyncStorage.setItem(adjStorageKey, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [adjStorageKey]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <MaterialCommunityIcons name="timer-outline" size={16} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SHOT RHYTHM</Text>
      </View>

      <View style={[styles.rhythmHeader, { backgroundColor: patternColor + "15", borderColor: patternColor + "40" }]}>
        <MaterialCommunityIcons name={meta.icon as any} size={22} color={patternColor} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rhythmPatternLabel, { color: patternColor }]}>{meta.label}</Text>
          {coachingCue && (
            <Text style={[styles.rhythmCue, { color: colors.foreground }]}>{coachingCue}</Text>
          )}
        </View>
        <View style={[styles.rhythmGradePill, { backgroundColor: patternColor + "25", borderColor: patternColor + "60" }]}>
          <Text style={[styles.rhythmGradeText, { color: patternColor }]}>{rhythmTier}</Text>
        </View>
      </View>

      <RhythmTimeline rhythm={rhythm} />

      {adjustments.length > 0 && (
        <View style={styles.rhythmAdjustmentsBlock}>
          <View style={[styles.sectionHeaderRow, { marginTop: 14, marginBottom: 6 }]}>
            <MaterialCommunityIcons name="metronome" size={14} color={patternColor} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>HOW TO FIX</Text>
          </View>
          {adjustments.map((step, i) => {
            const stepKey = `rhythm:${i}`;
            const isDone = doneSteps.has(stepKey);
            return (
              <Pressable
                key={`radj-${i}`}
                style={styles.adjustmentStep}
                onPress={() => toggleStep(stepKey)}
              >
                <View style={[
                  styles.adjustmentCheckbox,
                  isDone
                    ? { backgroundColor: patternColor, borderColor: patternColor }
                    : { borderColor: patternColor },
                ]}>
                  {isDone && <Feather name="check" size={9} color="#fff" />}
                </View>
                <Text style={[
                  styles.adjustmentNumber,
                  { color: isDone ? colors.mutedForeground : patternColor },
                ]}>{i + 1}</Text>
                <Text style={[
                  styles.adjustmentText,
                  {
                    color: isDone ? colors.mutedForeground : colors.foreground,
                    textDecorationLine: isDone ? "line-through" : "none",
                    opacity: isDone ? 0.5 : 0.88,
                  },
                ]}>{step}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
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
  const overallScore = analysis.overallScore;
  const scoreColor = tierColor(overallScore);
  const overallTier = scoreToTier(overallScore).label;
  const initialKeyFrameUri =
    session.isVideo && session.keyFrameUris && session.keyFrameUris.length > 0
      ? session.keyFrameUris[0]
      : session.imageUri;
  const initialFrameIdx =
    session.isVideo && session.keyFrameUris && session.keyFrameUris.length > 0 ? 0 : null;

  const [heroUri, setHeroUri] = useState<string | null>(initialKeyFrameUri);
  const [heroFailed, setHeroFailed] = useState(false);
  const [failedFrameIdxs, setFailedFrameIdxs] = useState<Set<number>>(new Set());
  const [activeFrameIdx, setActiveFrameIdx] = useState<number | null>(initialFrameIdx);
  const [expandedBodyZone, setExpandedBodyZone] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [seenZones, setSeenZones] = useState<Set<string>>(new Set());
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const adjStorageKey = `hoopform_adj_done_${session.id}`;
  const seenZonesKey = `hoopform_seen_zones_${session.id}`;

  useEffect(() => {
    AsyncStorage.getItem(adjStorageKey)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setDoneSteps(new Set(parsed));
        }
      })
      .catch(() => {});
  }, [adjStorageKey]);

  useEffect(() => {
    AsyncStorage.getItem(seenZonesKey)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setSeenZones(new Set(parsed));
        }
      })
      .catch(() => {});
  }, [seenZonesKey]);

  const markZoneSeen = useCallback((zoneKey: string) => {
    setSeenZones((prev) => {
      if (prev.has(zoneKey)) return prev;
      const next = new Set(prev);
      next.add(zoneKey);
      AsyncStorage.setItem(seenZonesKey, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [seenZonesKey]);

  const resetSeenZones = useCallback(() => {
    setSeenZones(new Set());
    AsyncStorage.removeItem(seenZonesKey).catch(() => {});
  }, [seenZonesKey]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    AsyncStorage.getItem(FEEDBACK_SUPPRESSED_KEY)
      .then((val) => {
        if (!active || val === "1") return;
        timer = setTimeout(() => { if (active) setFeedbackVisible(true); }, 2000);
      })
      .catch(() => {});
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const handleNeverShowFeedback = useCallback(() => {
    AsyncStorage.setItem(FEEDBACK_SUPPRESSED_KEY, "1").catch(() => {});
  }, []);

  const toggleStep = useCallback((key: string) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      AsyncStorage.setItem(adjStorageKey, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [adjStorageKey]);

  const hasKeyFrames =
    session.isVideo && session.keyFrameUris && session.keyFrameUris.length > 1;

  const sortedComponents = Object.entries(analysis.components ?? {}).sort(
    ([, a], [, b]) => (a?.score ?? Infinity) - (b?.score ?? Infinity)
  );

  const allAnnotations: FrameAnnotation[] = analysis.annotations ?? [];

  const activeAnnotations = useMemo(() => {
    if (allAnnotations.length === 0) return [];
    if (activeFrameIdx === null) {
      return allAnnotations.filter((a) => a.frameIndex === 0);
    }
    return allAnnotations.filter((a) => a.frameIndex === activeFrameIdx);
  }, [allAnnotations, activeFrameIdx]);

  return (
    <View style={[styles.screenWrap, { backgroundColor: colors.background }]}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={styles.imageContainer}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setImageLayout({ width, height });
        }}
      >
        {!heroFailed && heroUri ? (
          <Image
            source={{ uri: heroUri }}
            style={styles.heroImage}
            onError={() => setHeroFailed(true)}
          />
        ) : (
          <View style={[styles.heroImage, styles.heroImageFallback]}>
            <MaterialCommunityIcons name="image-off-outline" size={40} color="#444" />
          </View>
        )}

        {showAnnotations && activeAnnotations.length > 0 && imageLayout.width > 0 && (
          <FrameAnnotationOverlay
            annotations={activeAnnotations}
            containerWidth={imageLayout.width}
            containerHeight={imageLayout.height}
            imageUri={heroUri ?? ""}
            componentFeedback={analysis.components}
          />
        )}

        <Pressable
          style={[styles.backButton, { backgroundColor: colors.surface1 + "cc" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>

        {allAnnotations.length > 0 && (
          <Pressable
            style={[
              styles.annotationToggle,
              {
                backgroundColor: showAnnotations
                  ? colors.primary + "cc"
                  : colors.surface1 + "cc",
              },
            ]}
            onPress={() => setShowAnnotations((v) => !v)}
          >
            <Feather
              name={showAnnotations ? "eye" : "eye-off"}
              size={17}
              color={showAnnotations ? "#fff" : colors.mutedForeground}
            />
          </Pressable>
        )}

        <View style={styles.imageOverlay}>
          <View style={[styles.scoreBadge, { backgroundColor: colors.surface1 + "ee" }]}>
            <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{overallTier}</Text>
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
              const frameAnnotations = allAnnotations.filter(a => a.frameIndex === i);
              const summaryTier = frameTierSummary(frameAnnotations, analysis.components);
              const borderColor = summaryTier ? TIER_COLORS[summaryTier] : UNSCORED_COLOR;
              return (
                <Pressable
                  key={i}
                  style={styles.frameThumbWrapper}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, weakest annotated component: ${summaryTier ?? "unscored"}`}
                  onPress={() => {
                    setHeroUri(uri);
                    setActiveFrameIdx(i);
                  }}
                >
                  <View style={[
                    styles.frameThumb,
                    { borderColor, borderWidth: isActive ? 3 : 2 },
                  ]}>
                    {!failedFrameIdxs.has(i) ? (
                      <Image
                        source={{ uri }}
                        style={styles.frameThumbImg}
                        onError={() => setFailedFrameIdxs((prev) => new Set([...prev, i]))}
                      />
                    ) : (
                      <View style={[styles.frameThumbImg, styles.frameThumbFallback]}>
                        <MaterialCommunityIcons name="image-off-outline" size={14} color="#555" />
                      </View>
                    )}
                    {isActive && <View style={[styles.frameThumbActive, { backgroundColor: borderColor + "33" }]} />}
                  </View>
                  <Text style={[
                    styles.frameThumbLabel,
                    { color: colors.foreground },
                  ]}>{label}{session.keyFrameTimestamps?.[i] !== undefined
                    ? ` · ${(session.keyFrameTimestamps[i] / 1000).toFixed(2)}s`
                    : ""}</Text>
                  <Text style={[styles.frameThumbTier, { color: colors.foreground, borderColor, backgroundColor: colors.surface1 }]}>
                    {summaryTier ?? "Unscored"}
                  </Text>
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
                {typeof session.bestFrameIndex === "number" && typeof session.totalFrames === "number"
                  ? `Frame ${session.bestFrameIndex + 1}/${session.totalFrames}` : "Frame position unavailable"}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface1, borderColor: scoreColor + "50" }]}>
          <View style={styles.summaryTop}>
            <ScoreRing score={overallScore} size={80} strokeWidth={7} fontSize={26} />
            <View style={styles.summaryTopRight}>
              <Text style={[styles.overallLabel, { color: colors.mutedForeground }]}>OVERALL GRADE</Text>
              <Text style={[styles.gradeLabel, { color: scoreColor }]}>{overallTier}</Text>
            </View>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.coachParagraphRow}>
            <MaterialCommunityIcons name="whistle" size={14} color={colors.primary} style={{ marginTop: 2, flexShrink: 0 }} />
            <Text style={[styles.coachParagraphText, { color: colors.foreground }]}>{analysis.summary}</Text>
          </View>
          {overallScore === null && (
            <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>
              No overall score: some mechanics aren’t clearly visible. Available component scores are shown below; unscored feedback explains what’s missing. Film your full body and keep your hands and release visible.
            </Text>
          )}
          {overallScore !== null && session.rhythm && typeof session.rhythm.rhythmScore === "number" && session.rhythm.rhythmScore < 70 && (
            <View style={styles.rhythmNote}>
              <MaterialCommunityIcons name="metronome" size={13} color="#f59e0b" />
              <Text style={[styles.rhythmNoteText, { color: colors.mutedForeground }]}>
                Rhythm score: {session.rhythm.rhythmScore} — factored into your overall grade
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="human" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BODY MAP</Text>
            {(() => {
              const issueCount = BODY_ZONES.filter(({ key }) => {
                const comp = analysis.components?.[key as keyof typeof analysis.components];
                return scoreToTier(comp?.score).needsWork;
              }).length;
              return issueCount > 0 ? (
                <View style={[styles.bodyMapIssueBadge, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "66" }]}>
                  <Text style={[styles.bodyMapIssueBadgeText, { color: colors.destructive }]}>{issueCount} need work</Text>
                </View>
              ) : null;
            })()}
            {seenZones.size > 0 && (
              <Pressable onPress={resetSeenZones} style={styles.resetHintsButton} hitSlop={8}>
                <Text style={[styles.resetHintsText, { color: colors.mutedForeground }]}>reset hints</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.bodyMapGrid}>
            {BODY_ZONES.map(({ key, label, icon }) => {
              const component = analysis.components?.[key as keyof typeof analysis.components];
              const score = component?.score;
              const tier = knownTier(score);
              const zoneColor = componentTierColor(score);
              const isExpanded = expandedBodyZone === key;
              const isIssue = scoreToTier(score).needsWork;
              const isMajorIssue = scoreToTier(score).severity === "Critical";
              const isSeen = seenZones.has(key);
              const showHint = isIssue && !isSeen;
              const dotColor = tierColor(score);
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setExpandedBodyZone(prev => prev === key ? null : key);
                    if (isIssue) markZoneSeen(key);
                  }}
                  style={[
                    styles.bodyZoneCard,
                    {
                      backgroundColor: isExpanded ? zoneColor + "25" : zoneColor + "15",
                      borderColor: isExpanded ? zoneColor + "90" : zoneColor + "50",
                    },
                  ]}
                >
                  <View style={[styles.bodyZoneScoreBadge, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: zoneColor }]}>
                    <Text style={[styles.bodyZoneScoreText, { color: colors.foreground }]} adjustsFontSizeToFit numberOfLines={1}>
                      {key === "elbowPosition" && analysis.elbowVisible === false ? "Can't see from this angle" : tier ?? "—"}
                    </Text>
                  </View>
                  {showHint && (
                    <View style={styles.notificationDotWrapper}>
                      {isMajorIssue
                        ? <PulsingDot color={dotColor} />
                        : <View style={[styles.staticIssueDot, { backgroundColor: dotColor }]} />}
                    </View>
                  )}
                  <MaterialCommunityIcons name={icon as any} size={22} color={zoneColor} style={styles.bodyZoneIcon} />
                  <Text style={[styles.bodyZoneLabel, { color: colors.foreground }]} numberOfLines={2}>
                    {label}
                  </Text>
                  {showHint && isMajorIssue && (
                    <Text style={[styles.howToFixHint, { color: dotColor }]}>How to fix →</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          {/* Expanded body zone feedback */}
          {expandedBodyZone && (() => {
            const comp = analysis.components?.[expandedBodyZone as keyof typeof analysis.components];
            if (!comp) return null;
            const tier = knownTier(comp.score);
            const color = componentTierColor(comp.score);
            const feedback = typeof comp.feedback === "string"
              ? comp.feedback.split(/(?<=\.)\s+/).map((s) => s.replace(/\.$/, "").trim()).filter((s) => s.length > 2)
              : [];
            const adjustments: string[] = scoreToTier(comp.score).needsWork ? (comp.adjustments ?? []) : [];
            const zoneLabel = COMPONENT_LABELS[expandedBodyZone] ?? expandedBodyZone;
            const severity = tier && comp.score !== null ? scoreSeverity(comp.score) : null;
            return (
              <View style={[styles.bodyZoneExpanded, { backgroundColor: color + "12", borderColor: color + "40" }]}>
                <View style={styles.bodyZoneExpandedHeader}>
                  <Text style={[styles.bodyZoneExpandedTitle, { color: colors.foreground }]}>{zoneLabel}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {severity && severity !== "Good" && (
                      <View style={[styles.severityBadge, { backgroundColor: color + "22", borderColor: color }]}>
                        <Text style={[styles.severityBadgeText, { color: colors.foreground }]}>{severity}</Text>
                      </View>
                    )}
                    <View style={[styles.zoneGradeBadge, { backgroundColor: color + "33", borderColor: color }]}>
                      <Text style={[styles.zoneGradeText, { color: colors.foreground }]} adjustsFontSizeToFit numberOfLines={1}>{tier ?? "Unscored"}</Text>
                    </View>
                  </View>
                </View>
                {feedback.length === 0 && (
                  <Text style={[styles.bodyZoneExpandedEmpty, { color: colors.mutedForeground }]}>No issues found</Text>
                )}
                {feedback.map((item, i) => {
                  const parts = item.split(/\s*—\s*/);
                  return (
                    <View key={i} style={[styles.zonePopupItem, { borderLeftColor: color }]}>
                      {parts.length >= 2 ? (
                        <>
                          <Text style={[styles.zonePopupIssue, { color: colors.foreground }]}>{parts[0]}</Text>
                          <Text style={[styles.zonePopupFix, { color: colors.foreground }]}>{parts.slice(1).join(" — ")}</Text>
                        </>
                      ) : (
                        <Text style={[styles.zonePopupFix, { color: colors.foreground }]}>{item}</Text>
                      )}
                    </View>
                  );
                })}
                {adjustments.length > 0 && adjustments.map((step, i) => {
                  const stepKey = `${expandedBodyZone}:${i}`;
                  const isDone = doneSteps.has(stepKey);
                  return (
                    <Pressable
                      key={`adj-${i}`}
                      style={styles.adjustmentStep}
                      onPress={() => toggleStep(stepKey)}
                    >
                      <View style={[
                        styles.adjustmentCheckbox,
                        isDone
                          ? { backgroundColor: color, borderColor: color }
                          : { borderColor: color },
                      ]}>
                        {isDone && (
                          <Feather name="check" size={9} color="#fff" />
                        )}
                      </View>
                      <Text style={[
                        styles.adjustmentNumber,
                        { color: isDone ? colors.mutedForeground : color },
                      ]}>{i + 1}</Text>
                      <Text style={[
                        styles.adjustmentText,
                        {
                          color: isDone ? colors.mutedForeground : colors.foreground,
                          textDecorationLine: isDone ? "line-through" : "none",
                          opacity: isDone ? 0.5 : 0.88,
                        },
                      ]}>{step}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })()}
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
            <MaterialCommunityIcons name="format-list-numbered" size={16} color={colors.warning} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PRIORITY FIXES</Text>
          </View>
          {(analysis.priorityFixes ?? []).map((f, i) => {
            const rankColors = [colors.destructive, colors.warning, colors.primary];
            const rankColor = rankColors[i] ?? colors.mutedForeground;
            return (
              <View key={i} style={[styles.priorityFixCard, { backgroundColor: rankColor + "12", borderColor: rankColor + "40" }]}>
                <View style={[styles.priorityFixNumber, { backgroundColor: rankColor }]}>
                  <Text style={styles.priorityFixNumberText}>{i + 1}</Text>
                </View>
                <Text style={[styles.priorityFixText, { color: colors.foreground }]}>{f}</Text>
              </View>
            );
          })}
        </View>

        {session.rhythm && <RhythmSection rhythm={session.rhythm} sessionId={session.id} />}

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

    <FeedbackSheet
      visible={feedbackVisible}
      onClose={() => setFeedbackVisible(false)}
      onNeverShow={handleNeverShowFeedback}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1 },
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
    height: 320,
    backgroundColor: "#000",
  },
  heroImage: {
    width: "100%",
    height: 320,
    resizeMode: "contain",
  },
  heroImageFallback: {
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  frameThumbFallback: {
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
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
  frameThumbTier: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
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
  rhythmCue: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.9,
  },
  bodyZoneExpanded: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  bodyZoneExpandedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  bodyZoneExpandedTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  bodyZoneExpandedEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
  },
  annotationDotSelected: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  annotationTagSelected: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  zonePopup: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  zonePopupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  zonePopupTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  zoneGradeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  zoneGradeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  zonePopupItem: {
    borderLeftWidth: 2.5,
    paddingLeft: 8,
    gap: 2,
  },
  zonePopupIssue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  zonePopupFix: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
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
  annotationToggle: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
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
  resetHintsButton: {
    marginLeft: "auto",
  },
  resetHintsText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  bodyMapIssueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  bodyMapIssueBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
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
  notificationDotWrapper: {
    position: "absolute",
    top: -4,
    right: -4,
  },
  notificationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  howToFixHint: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    marginTop: 2,
    opacity: 0.85,
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
  coachParagraphRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  coachParagraphText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    flex: 1,
    opacity: 0.9,
  },
  staticIssueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.75,
  },
  severityBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  severityBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  priorityFixCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  priorityFixNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  priorityFixNumberText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  priorityFixText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    flex: 1,
  },
  adjustmentStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingLeft: 4,
    marginTop: 5,
  },
  adjustmentCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1.5,
    flexShrink: 0,
  },
  adjustmentNumber: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    width: 16,
    textAlign: "center",
    lineHeight: 17,
    flexShrink: 0,
  },
  adjustmentText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    flex: 1,
    opacity: 0.88,
  },
  rhythmNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f59e0b40",
  },
  rhythmNoteText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
    opacity: 0.8,
  },
  rhythmAdjustmentsBlock: {
    marginTop: 4,
  },
});
