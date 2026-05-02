import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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
import type { AnalysisResult, Session } from "@/context/SessionContext";
import { ScoreRing } from "@/components/ScoreRing";
import { extractFrames } from "@/utils/videoFrames";

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
  const [stage, setStage] = useState<AnalyzingStage>("idle");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [bestFrameInfo, setBestFrameInfo] = useState<{
    index: number;
    total: number;
  } | null>(null);

  const isAnalyzing = stage !== "idle";
  const recentSessions = sessions.slice(0, 3);
  const avgScore =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((acc, s) => acc + s.analysis.overallScore, 0) /
            sessions.length
        )
      : 0;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      await analyzeImage(asset.uri, asset.base64 ?? "");
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      await analyzeImage(asset.uri, asset.base64 ?? "");
    }
  };

  const recordVideo = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Mobile Only",
        "Video analysis requires the Expo Go app on your iPhone or Android device. Use the photo option in the browser."
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

  const pickVideo = async () => {
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
    setSelectedImage(null);
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
      const candidateFrames: { index: number; label: string }[] = [
        { index: 0, label: "Load" },
        ...(rhythm?.dipFrame !== undefined && rhythm.dipFrame > 0
          ? [{ index: rhythm.dipFrame, label: "Dip" }]
          : rhythm?.bodyRiseFrame !== undefined && rhythm.bodyRiseFrame > 0
          ? [{ index: rhythm.bodyRiseFrame, label: "Dip" }]
          : [{ index: Math.floor(totalFrames * 0.25), label: "Dip" }]),
        ...(rhythm?.ballRiseFrame !== undefined && rhythm.ballRiseFrame >= 0
          ? [{ index: rhythm.ballRiseFrame, label: "Set Point" }]
          : [{ index: Math.floor(totalFrames * 0.5), label: "Set Point" }]),
        { index: data.bestFrameIndex, label: "Release" },
        ...(rhythm?.armExtendFrame !== undefined && rhythm.armExtendFrame >= 0 && rhythm.armExtendFrame !== data.bestFrameIndex
          ? [{ index: rhythm.armExtendFrame, label: "Follow-Thru" }]
          : totalFrames - 1 !== data.bestFrameIndex
          ? [{ index: totalFrames - 1, label: "Follow-Thru" }]
          : []),
      ];

      // Deduplicate by index, clamp to valid range, keep order
      const seen = new Set<number>();
      const keyFrameEntries = candidateFrames
        .map((f) => ({ ...f, index: Math.max(0, Math.min(f.index, totalFrames - 1)) }))
        .filter((f) => thumbnailUris[f.index] && !seen.has(f.index) && seen.add(f.index))
        .slice(0, 5);

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

  const analyzeImage = async (uri: string, base64: string) => {
    if (!base64) {
      Alert.alert("Error", "Could not read image data.");
      return;
    }
    setStage("analyzing");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error((err as { error: string }).error ?? "Analysis failed");
      }

      const data = (await response.json()) as {
        analysis: AnalysisResult;
        timestamp: string;
      };
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const session: Session = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: data.timestamp,
        imageUri: uri,
        analysis: data.analysis,
        isVideo: false,
      };

      await addSession(session);
      setSelectedImage(null);
      setStage("idle");
      router.push({ pathname: "/analysis/[id]", params: { id: session.id } });
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "Something went wrong";
      Alert.alert("Analysis Failed", message);
      setStage("idle");
    }
  };

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
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>YOUR AI COACH</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Shot Doc <Text style={{ fontSize: 12, color: colors.mutedForeground }}>v2.0</Text></Text>
        </View>
        <MaterialCommunityIcons name="basketball" size={32} color={colors.primary} />
      </View>

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
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          PHOTO ANALYSIS
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryAction,
            {
              backgroundColor: colors.primary,
              opacity: pressed || isAnalyzing ? 0.7 : 1,
            },
          ]}
          onPress={takePhoto}
          disabled={isAnalyzing}
        >
          <Feather name="camera" size={22} color="#fff" />
          <Text style={styles.primaryActionText}>Take Photo</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryAction,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.border,
              opacity: pressed || isAnalyzing ? 0.7 : 1,
            },
          ]}
          onPress={pickImage}
          disabled={isAnalyzing}
        >
          <Feather name="image" size={20} color={colors.foreground} />
          <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>
            Upload Photo
          </Text>
        </Pressable>
      </View>

      <View style={styles.actionsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            VIDEO ANALYSIS
          </Text>
          <View
            style={[styles.newBadge, { backgroundColor: colors.success + "25" }]}
          >
            <Text style={[styles.newBadgeText, { color: colors.success }]}>NEW</Text>
          </View>
        </View>
        <Text style={[styles.videoSubtitle, { color: colors.mutedForeground }]}>
          AI automatically picks the best frame from your shot
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.videoAction,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.success + "60",
              opacity: pressed || isAnalyzing ? 0.7 : 1,
            },
          ]}
          onPress={recordVideo}
          disabled={isAnalyzing}
        >
          <View
            style={[
              styles.videoIconContainer,
              { backgroundColor: colors.success + "20" },
            ]}
          >
            <Feather name="video" size={20} color={colors.success} />
          </View>
          <View style={styles.videoActionText}>
            <Text style={[styles.videoActionTitle, { color: colors.foreground }]}>
              Record Shot
            </Text>
            <Text style={[styles.videoActionSub, { color: colors.mutedForeground }]}>
              8 frames extracted automatically
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.videoAction,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.border,
              opacity: pressed || isAnalyzing ? 0.7 : 1,
            },
          ]}
          onPress={pickVideo}
          disabled={isAnalyzing}
        >
          <View
            style={[
              styles.videoIconContainer,
              { backgroundColor: colors.accent + "20" },
            ]}
          >
            <Feather name="film" size={20} color={colors.accent} />
          </View>
          <View style={styles.videoActionText}>
            <Text style={[styles.videoActionTitle, { color: colors.foreground }]}>
              Upload Video
            </Text>
            <Text style={[styles.videoActionSub, { color: colors.mutedForeground }]}>
              Pick from your library
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
            />
          )}
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
            const scoreColor =
              score >= 80
                ? colors.success
                : score >= 60
                ? colors.warning
                : colors.destructive;
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
                    {score}/100
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
            Start Analyzing
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Take a photo, upload an image, or record a video of your shot for AI
            biomechanical feedback
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
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
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 10,
  },
  newBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  videoSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
    marginTop: -8,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryActionText: { fontSize: 15, fontFamily: "Inter_500Medium" },
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
