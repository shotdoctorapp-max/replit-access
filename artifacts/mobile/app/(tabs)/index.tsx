import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSessions } from "@/context/SessionContext";
import { useShots } from "@/context/ShotsContext";
import type { AnalysisResult, Session } from "@/context/SessionContext";
import { ScoreRing } from "@/components/ScoreRing";
import { scoreToGrade, gradeColor } from "@/utils/grading";
import { extractFrames } from "@/utils/videoFrames";
import { FilmingTipsSheet, shouldShowFilmingTips } from "@/components/FilmingTipsSheet";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type AnalyzingStage =
  | "idle"
  | "extracting"
  | "selecting"
  | "analyzing";

const STAGE_LABELS: Record<AnalyzingStage, string> = {
  idle: "",
  extracting: "Extracting key frames...",
  selecting: "AI selecting best moment...",
  analyzing: "Analyzing biomechanics...",
};

function PulsingDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0.3, { duration: 700 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]}
    />
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions, addSession } = useSessions();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { shotsRemaining, totalFreeShots, isPro, consumeShot } = useShots();
  const [stage, setStage] = useState<AnalyzingStage>("idle");
  const [bestFrameInfo, setBestFrameInfo] = useState<{
    index: number;
    total: number;
  } | null>(null);
  const [showTipsSheet, setShowTipsSheet] = useState(false);

  const isAnalyzing = stage !== "idle";
  const recentSessions = sessions.slice(0, 3);
  const avgScore =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((acc, s) => acc + s.analysis.overallScore, 0) /
            sessions.length
        )
      : 0;

  const checkShotsOrPaywall = (): boolean => {
    if (isPro) return true;
    if (shotsRemaining <= 0) {
      router.push("/paywall");
      return false;
    }
    return true;
  };

  const openCamera = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Mobile Only",
        "Video analysis requires the Expo Go app on your iPhone or Android device."
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access to record your shot.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 10,
      quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await analyzeVideo(asset.uri, asset.duration ?? undefined);
    }
  };

  const recordVideo = async () => {
    if (!checkShotsOrPaywall()) return;
    const show = await shouldShowFilmingTips();
    if (show) {
      setShowTipsSheet(true);
    } else {
      await openCamera();
    }
  };

  const pickVideo = async () => {
    if (!checkShotsOrPaywall()) return;
    if (Platform.OS === "web") {
      Alert.alert(
        "Mobile Only",
        "Video analysis requires the Expo Go app on your iPhone or Android device."
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your video library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await analyzeVideo(asset.uri, asset.duration ?? undefined);
    }
  };

  const analyzeVideo = async (videoUri: string, durationMs?: number) => {
    setBestFrameInfo(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      setStage("extracting");
      const { base64Frames, thumbnailUris, timestamps } = await extractFrames(videoUri, durationMs);

      setStage("selecting");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const response = await fetch(`${API_BASE}/api/analyze-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: base64Frames, timestamps, mimeType: "image/jpeg" }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error((err as { error: string }).error ?? "Analysis failed");
      }

      setStage("analyzing");
      const data = (await response.json()) as {
        analysis: AnalysisResult;
        rhythm?: import("@/context/SessionContext").RhythmAnalysis;
        bestFrameIndex: number;
        totalFrames: number;
        timestamp: string;
        annotationDipFrame?: number;
        annotationSetPointFrame?: number;
      };

      setBestFrameInfo({ index: data.bestFrameIndex, total: data.totalFrames });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const FileSystem = await import("expo-file-system/legacy");
      const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      // Save the best frame thumbnail as a stable file for the analysis screen
      let capturedFrameUri = videoUri;
      const bestThumbUri = thumbnailUris[data.bestFrameIndex] ?? thumbnailUris[0];
      if (bestThumbUri) {
        try {
          const destUri = `${FileSystem.cacheDirectory}shotdoc_frame_${sessionId}_best.jpg`;
          await FileSystem.copyAsync({ from: bestThumbUri, to: destUri });
          capturedFrameUri = destUri;
        } catch {
          // fall back to videoUri
        }
      }

      // Select key frames that show the progression of the shot
      const totalFrames = data.totalFrames ?? thumbnailUris.length;
      const rhythm = data.rhythm;
      // 3 key frames: Dip, Set Point, Release — selected using rhythm data with
      // fixed-percentage fallbacks. Annotation frame indices from the server are NOT
      // used here; they serve overlay alignment only (not the key-moment strip).

      // Dip: rhythm.dipFrame if in [0, 45%), else 20% fallback
      let dipIdx = (() => {
        const d = rhythm?.dipFrame;
        if (d !== undefined && d >= 0 && d < totalFrames * 0.45) return d;
        return Math.floor(totalFrames * 0.20);
      })();

      // Set Point: rhythm.setPointFrame if in [40%, 75%) and after dip,
      //            else armExtendFrame - 1 clamped above dip, else 55% fallback
      let setPointIdx = (() => {
        const sp = rhythm?.setPointFrame;
        if (sp !== undefined && sp > dipIdx && sp >= totalFrames * 0.4 && sp < totalFrames * 0.75) return sp;
        const ae = rhythm?.armExtendFrame;
        if (ae !== undefined && ae > dipIdx + 1) return ae - 1;
        return Math.floor(totalFrames * 0.55);
      })();

      // Release: rhythm.armExtendFrame if in [60%, 95%) and after set point, else 78% fallback
      let releaseIdx = (() => {
        const ae = rhythm?.armExtendFrame;
        if (ae !== undefined && ae > setPointIdx && ae >= totalFrames * 0.6 && ae < totalFrames * 0.95) return ae;
        return Math.floor(totalFrames * 0.78);
      })();

      // Clamp all to valid range
      dipIdx      = Math.max(0, Math.min(dipIdx,      totalFrames - 1));
      setPointIdx = Math.max(0, Math.min(setPointIdx, totalFrames - 1));
      releaseIdx  = Math.max(0, Math.min(releaseIdx,  totalFrames - 1));

      // Resolve collisions: guarantee dipIdx < setPointIdx < releaseIdx when enough frames exist
      if (setPointIdx <= dipIdx)      setPointIdx = Math.min(dipIdx      + 1, totalFrames - 1);
      if (releaseIdx  <= setPointIdx) releaseIdx  = Math.min(setPointIdx + 1, totalFrames - 1);

      const candidateFrames: { index: number; label: string }[] = [
        { index: dipIdx,      label: "Dip"       },
        { index: setPointIdx, label: "Set Point"  },
        { index: releaseIdx,  label: "Release"    },
      ];

      // Remove entries whose thumbnail is missing or whose index duplicates an earlier entry
      const seen = new Set<number>();
      const keyFrameEntries = candidateFrames
        .filter((f) => thumbnailUris[f.index] !== undefined && !seen.has(f.index) && seen.add(f.index))
        .slice(0, 3);

      // Copy key frame thumbnails to stable cache paths
      const keyFrameUris: string[] = [];
      const keyFrameLabels: string[] = [];
      for (let i = 0; i < keyFrameEntries.length; i++) {
        const { index, label } = keyFrameEntries[i];
        const src = thumbnailUris[index];
        if (!src) continue;
        try {
          const dest = `${FileSystem.cacheDirectory}shotdoc_frame_${sessionId}_kf${i}.jpg`;
          await FileSystem.copyAsync({ from: src, to: dest });
          keyFrameUris.push(dest);
          keyFrameLabels.push(label);
        } catch {
          // skip this frame if copy fails
        }
      }

      const session: Session = {
        id: sessionId,
        timestamp: data.timestamp,
        imageUri: capturedFrameUri,
        analysis: data.analysis,
        rhythm: data.rhythm,
        isVideo: true,
        bestFrameIndex: data.bestFrameIndex,
        totalFrames: data.totalFrames,
        keyFrameUris: keyFrameUris.length > 0 ? keyFrameUris : undefined,
        keyFrameLabels: keyFrameLabels.length > 0 ? keyFrameLabels : undefined,
      };

      await consumeShot();
      await addSession(session);
      setStage("idle");
      router.push({ pathname: "/analysis/[id]", params: { id: session.id } });
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "Something went wrong";
      Alert.alert("Video Analysis Failed", message);
      setStage("idle");
    }
  };

  return (
    <>
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
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>YOUR AI COACH</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Shot Doc <Text style={{ fontSize: 12, color: colors.mutedForeground }}>v2.1</Text></Text>
        </View>
        <Pressable
          onPress={() => signOut()}
          style={[styles.userChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="account-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.userChipText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "Account"}
          </Text>
        </Pressable>
      </View>

      {!isPro && (
        <Pressable
          style={[styles.shotsBar, { backgroundColor: colors.surface1, borderColor: colors.border }]}
          onPress={() => router.push("/paywall")}
        >
          <View style={styles.shotsBarLeft}>
            <MaterialCommunityIcons
              name="basketball-hoop"
              size={16}
              color={shotsRemaining > 0 ? colors.primary : colors.destructive}
            />
            <Text style={[styles.shotsBarLabel, { color: colors.foreground }]}>
              {shotsRemaining > 0
                ? `${shotsRemaining} free shot${shotsRemaining !== 1 ? "s" : ""} remaining`
                : "No shots remaining"}
            </Text>
          </View>
          <View style={styles.shotsDotsRow}>
            {Array.from({ length: totalFreeShots }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.shotDot,
                  {
                    backgroundColor: i < shotsRemaining
                      ? colors.primary
                      : colors.surface3 ?? colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.shotsBarUpgrade, { color: colors.primary }]}>Upgrade</Text>
        </Pressable>
      )}

      {sessions.length > 0 && (
        <View
          style={[
            styles.statsCard,
            { backgroundColor: colors.surface1, borderColor: colors.border },
          ]}
        >
          <View style={styles.statItem}>
            <ScoreRing
              score={avgScore}
              size={70}
              strokeWidth={6}
              fontSize={20}
              label="Avg Score"
            />
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {sessions.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Sessions
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statNumber,
                {
                  color:
                    sessions.length >= 2 &&
                    sessions[0].analysis.overallScore >
                      sessions[1].analysis.overallScore
                      ? colors.success
                      : colors.warning,
                },
              ]}
            >
              {sessions.length >= 2
                ? (sessions[0].analysis.overallScore -
                      sessions[1].analysis.overallScore >
                    0
                    ? "+"
                    : "") +
                  (sessions[0].analysis.overallScore -
                    sessions[1].analysis.overallScore)
                : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Trend
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actionsSection}>
        <Pressable
          style={({ pressed }) => [
            styles.recordBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed || isAnalyzing ? 0.75 : 1,
            },
          ]}
          onPress={pickVideo}
          disabled={isAnalyzing}
        >
          <Feather name="upload" size={24} color="#fff" />
          <View style={styles.recordBtnText}>
            <Text style={styles.recordBtnTitle}>Upload Slow-Mo Video</Text>
            <Text style={styles.recordBtnSub}>Record in Slo-Mo, then upload for best results</Text>
          </View>
        </Pressable>
      </View>

      {isAnalyzing && (
        <View
          style={[
            styles.analyzingCard,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.primary + "40",
            },
          ]}
        >
          <View style={styles.stagesContainer}>
            {(["extracting", "selecting", "analyzing"] as AnalyzingStage[]).map(
              (s) => {
                const isActive = stage === s;
                const isDone =
                  (s === "extracting" &&
                    (stage === "selecting" || stage === "analyzing")) ||
                  (s === "selecting" && stage === "analyzing");
                const stageColor = isDone
                  ? colors.success
                  : isActive
                  ? colors.primary
                  : colors.mutedForeground + "50";
                return (
                  <View key={s} style={styles.stageRow}>
                    {isDone ? (
                      <Feather name="check-circle" size={16} color={colors.success} />
                    ) : isActive ? (
                      <PulsingDot color={colors.primary} />
                    ) : (
                      <View
                        style={[
                          styles.stageDot,
                          { backgroundColor: colors.surface3 },
                        ]}
                      />
                    )}
                    <Text style={[styles.stageLabel, { color: stageColor }]}>
                      {STAGE_LABELS[s]}
                    </Text>
                  </View>
                );
              }
            )}
            {stage === "analyzing" && (
              <ActivityIndicator
                color={colors.primary}
                size="small"
                style={styles.spinner}
              />
            )}
          </View>
          {bestFrameInfo && (
            <Text style={[styles.frameInfo, { color: colors.mutedForeground }]}>
              Best frame: #{bestFrameInfo.index + 1} of {bestFrameInfo.total}
            </Text>
          )}
        </View>
      )}

      {recentSessions.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              RECENT SESSIONS
            </Text>
            <Pressable onPress={() => router.push("/history")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </Pressable>
          </View>
          {recentSessions.map((session) => {
            const score = session.analysis.overallScore;
            const scoreColor = gradeColor(score, colors);
            const grade = scoreToGrade(score);
            return (
              <Pressable
                key={session.id}
                style={({ pressed }) => [
                  styles.sessionCard,
                  {
                    backgroundColor: colors.surface1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/analysis/[id]",
                    params: { id: session.id },
                  })
                }
              >
                <View style={styles.sessionImageContainer}>
                  <Image
                    source={{ uri: session.imageUri }}
                    style={styles.sessionImage}
                  />
                  {session.isVideo && (
                    <View
                      style={[
                        styles.videoTag,
                        { backgroundColor: colors.success + "cc" },
                      ]}
                    >
                      <Feather name="video" size={9} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.sessionInfo}>
                  <Text
                    style={[styles.sessionDate, { color: colors.mutedForeground }]}
                  >
                    {new Date(session.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text style={[styles.sessionScore, { color: scoreColor }]}>
                    {grade}
                  </Text>
                  <Text
                    style={[
                      styles.sessionSummary,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={2}
                  >
                    {session.analysis.summary}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {sessions.length === 0 && !isAnalyzing && (
        <View style={[styles.emptyState, { borderColor: colors.border }]}>
          <MaterialCommunityIcons
            name="basketball-hoop"
            size={48}
            color={colors.mutedForeground}
          />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Record Your First Shot
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Hit Record, take your shot, and get AI biomechanical feedback in seconds
          </Text>
        </View>
      )}
    </ScrollView>

    <FilmingTipsSheet
      visible={showTipsSheet}
      onConfirm={() => {
        setShowTipsSheet(false);
        pickVideo();
      }}
      onDismiss={() => setShowTipsSheet(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  greeting: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 130,
  },
  userChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  shotsBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 10,
  },
  shotsBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  shotsBarLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  shotsDotsRow: {
    flexDirection: "row",
    gap: 5,
  },
  shotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shotsBarUpgrade: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center", flex: 1 },
  statDivider: { width: 1, height: 40 },
  statNumber: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  actionsSection: { marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: 18,
    marginBottom: 12,
  },
  recordBtnText: { flex: 1 },
  recordBtnTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  recordBtnSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  uploadBtnInner: {
    flex: 1,
  },
  uploadBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  uploadBtnSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  recommendedBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  recommendedText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: 0.2,
  },
  videoAction: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  videoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  videoActionText: { flex: 1 },
  videoActionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  videoActionSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  analyzingCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  previewImage: { width: "100%", height: 160, resizeMode: "cover" },
  stagesContainer: { padding: 16, gap: 10 },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stageDot: { width: 8, height: 8, borderRadius: 4 },
  stageLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  spinner: { marginTop: 4 },
  frameInfo: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  recentSection: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  sessionImageContainer: { position: "relative" },
  sessionImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    resizeMode: "cover",
  },
  videoTag: {
    position: "absolute",
    bottom: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: { flex: 1 },
  sessionDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  sessionScore: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sessionSummary: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    marginTop: 16,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
