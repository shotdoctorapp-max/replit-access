import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import React, { useMemo, useState, useCallback } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { CourtBackground } from "@/components/CourtBackground";
import { useSessions } from "@/context/SessionContext";
import { DrillCard } from "@/components/DrillCard";
import type { DrillRecommendation } from "@/context/SessionContext";
import { isFilmingTipsSuppressed, resetFilmingTips } from "@/components/FilmingTipsSheet";
import { BugReportSheet } from "@/components/BugReportSheet";
import { FEEDBACK_FORM_URL } from "@/components/FeedbackSheet";

const SHARE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://shotdoc.replit.app";

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

const FILMING_TIPS = [
  {
    icon: "speedometer-slow" as const,
    title: "Record in Slow-Mo",
    body: "iPhone: open Camera → swipe to Slo-Mo → record → upload from library",
    highlight: true,
  },
  {
    icon: "rotate-3d-variant" as const,
    title: "Side / Profile View",
    body: "Film from the side so the AI can see your full shooting motion",
    highlight: false,
  },
  {
    icon: "human-male-height" as const,
    title: "Full Body in Frame",
    body: "Step back so your feet and hands are visible throughout the shot",
    highlight: false,
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
  const [tipsHidden, setTipsHidden] = useState(false);
  const [bugReportVisible, setBugReportVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      isFilmingTipsSuppressed().then((suppressed) => {
        if (active) setTipsHidden(suppressed);
      });
      return () => { active = false; };
    }, [])
  );

  const handleResetFilmingTips = async () => {
    await resetFilmingTips();
    setTipsHidden(false);
    Alert.alert("Filming Tips Re-enabled", "You'll see the filming tips next time you record a shot.");
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out Shot Doctor — AI that analyzes your basketball shooting form and tells you exactly how to fix it. 🏀\n${SHARE_URL}`,
        url: SHARE_URL,
      });
    } catch {
      // user cancelled or error — no-op
    }
  };

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CourtBackground />
    <ScrollView
      style={styles.fill}
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
        FILMING TIPS
      </Text>
      {FILMING_TIPS.map((tip, i) => (
        <View
          key={tip.title}
          style={[
            styles.tipCard,
            tip.highlight
              ? { backgroundColor: colors.primary + "15", borderColor: colors.primary + "50" }
              : { backgroundColor: colors.surface1, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.tipIcon,
              { backgroundColor: (tip.highlight ? colors.primary : colors.accent) + "20" },
            ]}
          >
            <MaterialCommunityIcons
              name={tip.icon}
              size={20}
              color={tip.highlight ? colors.primary : colors.accent}
            />
          </View>
          <View style={styles.tipContent}>
            <View style={styles.tipTitleRow}>
              <View style={[styles.tipBadge, { backgroundColor: tip.highlight ? colors.primary : colors.border }]}>
                <Text style={[styles.tipBadgeNum, { color: tip.highlight ? colors.primaryForeground : colors.mutedForeground }]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={[styles.tipTitle, { color: colors.foreground }]}>{tip.title}</Text>
            </View>
            <Text style={[styles.tipBody, { color: colors.mutedForeground }]}>{tip.body}</Text>
          </View>
        </View>
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

      <Pressable
        style={({ pressed }) => [
          styles.shareCard,
          { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={handleShare}
      >
        <MaterialCommunityIcons name="share-variant" size={24} color={colors.primaryForeground} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.shareCardTitle, { color: colors.primaryForeground }]}>
            Share Shot Doctor
          </Text>
          <Text style={[styles.shareCardSub, { color: colors.primaryForeground }]}>
            Know a baller who needs this? Send it.
          </Text>
        </View>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>
        PREFERENCES
      </Text>
      <View style={[styles.prefCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
        <View style={styles.prefRow}>
          <View style={[styles.prefIconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="video" size={18} color={colors.primary} />
          </View>
          <View style={styles.prefText}>
            <Text style={[styles.prefTitle, { color: colors.foreground }]}>Filming Tips</Text>
            <Text style={[styles.prefSubtitle, { color: colors.mutedForeground }]}>
              {tipsHidden
                ? "Hidden — shown before recording"
                : "Shown before each recording"}
            </Text>
          </View>
          {tipsHidden ? (
            <Pressable
              style={({ pressed }) => [
                styles.prefButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleResetFilmingTips}
            >
              <Text style={[styles.prefButtonText, { color: colors.primaryForeground }]}>
                Re-enable
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.prefBadge, { backgroundColor: colors.success + "20" }]}>
              <Feather name="check" size={12} color={colors.success} />
              <Text style={[styles.prefBadgeText, { color: colors.success }]}>On</Text>
            </View>
          )}
        </View>

        <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

        <Pressable
          style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setBugReportVisible(true)}
        >
          <View style={[styles.prefIconWrap, { backgroundColor: colors.mutedForeground + "20" }]}>
            <Feather name="alert-circle" size={18} color={colors.mutedForeground} />
          </View>
          <View style={styles.prefText}>
            <Text style={[styles.prefTitle, { color: colors.foreground }]}>Report a Bug</Text>
            <Text style={[styles.prefSubtitle, { color: colors.mutedForeground }]}>
              Something not working? Let us know
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

        <Pressable
          style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => Linking.openURL(FEEDBACK_FORM_URL).catch(() => {})}
        >
          <View style={[styles.prefIconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="message-square" size={18} color={colors.primary} />
          </View>
          <View style={styles.prefText}>
            <Text style={[styles.prefTitle, { color: colors.foreground }]}>Send Feedback</Text>
            <Text style={[styles.prefSubtitle, { color: colors.mutedForeground }]}>
              Share your thoughts on Shot Doctor
            </Text>
          </View>
          <Feather name="external-link" size={18} color={colors.mutedForeground} />
        </Pressable>

        <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

        <Pressable
          style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleShare}
        >
          <View style={[styles.prefIconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="share-2" size={18} color={colors.primary} />
          </View>
          <View style={styles.prefText}>
            <Text style={[styles.prefTitle, { color: colors.foreground }]}>Share with Friends</Text>
            <Text style={[styles.prefSubtitle, { color: colors.mutedForeground }]}>
              Spread the word about Shot Doctor
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <BugReportSheet
        visible={bugReportVisible}
        onClose={() => setBugReportVisible(false)}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fill: { flex: 1 },
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
  tipTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  tipBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipBadgeNum: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
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
  prefCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prefIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  prefText: {
    flex: 1,
  },
  prefTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  prefSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  prefButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  prefButtonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  prefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  prefBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  prefDivider: {
    height: 1,
    marginVertical: 12,
  },
  shareCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    marginBottom: 24,
  },
  shareCardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  shareCardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    opacity: 0.85,
  },
});
